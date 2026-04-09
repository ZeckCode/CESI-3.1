from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations


WHOLE_PESO = Decimal('1')


def normalize_money(value):
    return Decimal(str(value or 0)).quantize(WHOLE_PESO, rounding=ROUND_HALF_UP)


def recalculate_finance_rows(apps, schema_editor):
    Transaction = apps.get_model('finance', 'Transaction')

    today = date.today()

    enrollment_ids = (
        Transaction.objects.exclude(enrollment_id__isnull=True)
        .values_list('enrollment_id', flat=True)
        .distinct()
    )

    for enrollment_id in enrollment_ids:
        rows = list(
            Transaction.objects.filter(enrollment_id=enrollment_id).order_by(
                'transaction_date', 'date_posted', 'id'
            )
        )

        running = Decimal('0.00')
        credit_pool = Decimal('0.00')
        debit_rows = []

        for row in rows:
            debit_amount = normalize_money(row.debit)
            credit_amount = normalize_money(row.credit)

            running = normalize_money(running + debit_amount - credit_amount)
            if row.balance != running:
                row.balance = running
                row.save(update_fields=['balance'])

            if row.entry_type == 'CREDIT':
                if credit_amount > 0:
                    credit_pool = normalize_money(credit_pool + credit_amount)

                desired_status = 'PAID' if row.item in {'PAYMENT', 'ADVANCE'} else 'POSTED'
                if row.status != desired_status:
                    row.status = desired_status
                    row.save(update_fields=['status'])
            else:
                debit_rows.append(row)

        debit_rows.sort(
            key=lambda row: (
                row.due_date or row.transaction_date or today,
                row.date_posted or row.transaction_date or today,
                row.id,
            )
        )

        for row in debit_rows:
            debit_amount = normalize_money(row.debit)

            if credit_pool <= 0:
                if row.due_date and row.due_date < today:
                    desired_status = 'OVERDUE'
                else:
                    desired_status = row.status or 'POSTED'
            elif credit_pool >= debit_amount:
                desired_status = 'PAID'
                credit_pool = normalize_money(credit_pool - debit_amount)
            else:
                desired_status = 'PARTIAL'
                credit_pool = Decimal('0.00')

            if row.status != desired_status:
                row.status = desired_status
                row.save(update_fields=['status'])


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0017_backfill_round_money_and_settle_statuses'),
    ]

    operations = [
        migrations.RunPython(recalculate_finance_rows, migrations.RunPython.noop),
    ]
