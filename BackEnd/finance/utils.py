from collections import deque
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .models import Transaction


WHOLE_PESO = Decimal('1')
BILLING_DEBIT_ITEMS = {
    'REGISTRATION',
    'INITIAL',
    'MONTHLY',
    'MISC',
    'RESERVATION',
    'ASSESSMENT',
}


def normalize_money(value):
    return Decimal(str(value or 0)).quantize(WHOLE_PESO, rounding=ROUND_HALF_UP)


def recompute_running_balances_for_enrollment(enrollment):
    rows = Transaction.objects.filter(enrollment=enrollment).order_by(
        'transaction_date', 'date_posted', 'id'
    )

    running = Decimal('0.00')
    for row in rows:
        running += normalize_money(row.debit) - normalize_money(row.credit)
        running = normalize_money(running)
        if row.balance != running:
            row.balance = running
            row.save(update_fields=['balance'])

    return running


def recompute_transaction_statuses_for_enrollment(enrollment):
    rows = Transaction.objects.filter(enrollment=enrollment).order_by(
        'transaction_date', 'date_posted', 'id'
    )

    today = date.today()
    available_credit = Decimal('0.00')
    debit_rows = []

    for row in rows:
        credit_amount = normalize_money(row.credit)

        if row.entry_type == 'CREDIT':
            if credit_amount > 0:
                available_credit = normalize_money(available_credit + credit_amount)

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
        due_basis = row.due_date or row.transaction_date or today
        is_billing_debit = (row.item or '').upper() in BILLING_DEBIT_ITEMS

        if available_credit <= 0:
            if is_billing_debit:
                desired_status = 'OVERDUE' if due_basis < today else 'PENDING'
            else:
                desired_status = row.status or 'POSTED'
        elif available_credit >= debit_amount:
            desired_status = 'PAID'
            available_credit = normalize_money(available_credit - debit_amount)
        else:
            if is_billing_debit and due_basis < today:
                desired_status = 'OVERDUE'
            else:
                desired_status = 'PARTIAL'
            available_credit = Decimal('0.00')

        if row.status != desired_status:
            row.status = desired_status
            row.save(update_fields=['status'])
