from collections import deque
from datetime import date
from decimal import Decimal

from django.db import migrations


def recalculate_statuses(apps, schema_editor):
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

        available_credit = Decimal('0.00')
        outstanding_debits = deque()

        for row in rows:
            debit_amount = Decimal(str(row.debit or 0))
            credit_amount = Decimal(str(row.credit or 0))

            if row.entry_type == 'CREDIT':
                if credit_amount > 0:
                    available_credit += credit_amount

                desired_status = 'PAID' if row.item in {'PAYMENT', 'ADVANCE'} else 'POSTED'
                if row.status != desired_status:
                    row.status = desired_status
                    row.save(update_fields=['status'])

                while available_credit > 0 and outstanding_debits:
                    debit_entry = outstanding_debits[0]
                    applied = min(available_credit, debit_entry['remaining'])
                    debit_entry['remaining'] -= applied
                    debit_entry['applied'] += applied
                    available_credit -= applied

                    if debit_entry['remaining'] <= 0:
                        if debit_entry['row'].status != 'PAID':
                            debit_entry['row'].status = 'PAID'
                            debit_entry['row'].save(update_fields=['status'])
                        outstanding_debits.popleft()
                    else:
                        if debit_entry['row'].status != 'PARTIAL':
                            debit_entry['row'].status = 'PARTIAL'
                            debit_entry['row'].save(update_fields=['status'])
                        break

            else:
                remaining = debit_amount
                applied = Decimal('0.00')

                if available_credit > 0:
                    applied = min(available_credit, remaining)
                    remaining -= applied
                    available_credit -= applied

                if remaining <= 0:
                    desired_status = 'PAID'
                elif applied > 0:
                    desired_status = 'PARTIAL'
                elif row.due_date and row.due_date < today:
                    desired_status = 'OVERDUE'
                else:
                    desired_status = row.status or 'POSTED'

                if row.status != desired_status:
                    row.status = desired_status
                    row.save(update_fields=['status'])

                if remaining > 0:
                    outstanding_debits.append({
                        'row': row,
                        'remaining': remaining,
                        'applied': applied,
                    })

        for debit_entry in outstanding_debits:
            row = debit_entry['row']
            if debit_entry['remaining'] <= 0:
                desired_status = 'PAID'
            elif debit_entry['applied'] > 0:
                desired_status = 'PARTIAL'
            elif row.due_date and row.due_date < today:
                desired_status = 'OVERDUE'
            else:
                desired_status = row.status or 'POSTED'

            if row.status != desired_status:
                row.status = desired_status
                row.save(update_fields=['status'])


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0015_alter_advancerequest_id_alter_proofofpayment_id_and_more'),
    ]

    operations = [
        migrations.RunPython(recalculate_statuses, migrations.RunPython.noop),
    ]
