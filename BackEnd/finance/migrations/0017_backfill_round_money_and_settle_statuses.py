from collections import deque
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations


WHOLE_PESO = Decimal('1')


def normalize_money(value):
    return Decimal(str(value or 0)).quantize(WHOLE_PESO, rounding=ROUND_HALF_UP)


def recalculate_finance_rows(apps, schema_editor):
    Transaction = apps.get_model('finance', 'Transaction')

    for transaction in Transaction.objects.all():
        rounded_amount = normalize_money(transaction.amount)
        rounded_debit = normalize_money(transaction.debit)
        rounded_credit = normalize_money(transaction.credit)
        rounded_balance = normalize_money(transaction.balance)

        changed = False
        if transaction.amount != rounded_amount:
            transaction.amount = rounded_amount
            changed = True
        if transaction.debit != rounded_debit:
            transaction.debit = rounded_debit
            changed = True
        if transaction.credit != rounded_credit:
            transaction.credit = rounded_credit
            changed = True
        if transaction.balance != rounded_balance:
            transaction.balance = rounded_balance
            changed = True

        if changed:
            transaction.save(update_fields=['amount', 'debit', 'credit', 'balance'])

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
        available_credit = Decimal('0.00')
        outstanding_debits = deque()

        for row in rows:
            debit_amount = normalize_money(row.debit)
            credit_amount = normalize_money(row.credit)

            running += debit_amount - credit_amount
            running = normalize_money(running)
            if row.balance != running:
                row.balance = running
                row.save(update_fields=['balance'])

            if row.entry_type == 'CREDIT':
                if credit_amount > 0:
                    available_credit += credit_amount
                    available_credit = normalize_money(available_credit)

                desired_status = 'PAID' if row.item in {'PAYMENT', 'ADVANCE'} else 'POSTED'
                if row.status != desired_status:
                    row.status = desired_status
                    row.save(update_fields=['status'])

                while available_credit > 0 and outstanding_debits:
                    debit_entry = outstanding_debits[0]
                    applied = min(available_credit, debit_entry['remaining'])
                    debit_entry['remaining'] -= applied
                    debit_entry['remaining'] = normalize_money(debit_entry['remaining'])
                    debit_entry['applied'] += applied
                    debit_entry['applied'] = normalize_money(debit_entry['applied'])
                    available_credit -= applied
                    available_credit = normalize_money(available_credit)

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
                    available_credit = normalize_money(available_credit)

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
        ('finance', '0016_backfill_transaction_statuses'),
    ]

    operations = [
        migrations.RunPython(recalculate_finance_rows, migrations.RunPython.noop),
    ]
