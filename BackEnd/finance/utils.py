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

DEBIT_ALLOCATION_PRIORITY = {
    'INITIAL': 0,
    'ASSESSMENT': 1,
}


def normalize_money(value):
    return Decimal(str(value or 0)).quantize(WHOLE_PESO, rounding=ROUND_HALF_UP)


def normalize_transaction_item(item_value):
    raw = str(item_value or '').strip().upper()
    if not raw:
        return ''

    normalized = raw.replace('-', '_').replace(' ', '_')

    direct_aliases = {
        'INITIAL_PAYMENT': 'INITIAL',
        'ASSESSMENT_FEE': 'ASSESSMENT',
        'MONTHLY_INSTALLMENT': 'MONTHLY',
        'ADVANCE_CREDIT': 'ADVANCE',
    }
    if normalized in direct_aliases:
        return direct_aliases[normalized]

    if 'INITIAL' in normalized:
        return 'INITIAL'
    if 'ASSESS' in normalized:
        return 'ASSESSMENT'
    if 'MONTH' in normalized:
        return 'MONTHLY'
    if 'MISC' in normalized:
        return 'MISC'
    if normalized.startswith('PAYMENT') or 'PAYMENT' in normalized:
        return 'PAYMENT'
    if normalized.startswith('ADVANCE_TRANSFER_OUT'):
        return 'ADVANCE_TRANSFER_OUT'
    if normalized.startswith('ADVANCE_APPLIED'):
        return 'ADVANCE_APPLIED'
    if normalized.startswith('ADVANCE'):
        return 'ADVANCE'

    return normalized


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
        row_item_key = normalize_transaction_item(row.item)
        credit_amount = normalize_money(row.credit)

        if row.entry_type == 'CREDIT':
            if credit_amount > 0:
                available_credit = normalize_money(available_credit + credit_amount)

            desired_status = 'PAID' if row_item_key in {'PAYMENT', 'ADVANCE'} else 'POSTED'
            if row.status != desired_status:
                row.status = desired_status
                row.save(update_fields=['status'])

        else:
            debit_rows.append(row)

    # Preserve billing intent by always allocating credits to
    # Initial and Assessment entries before monthly installments,
    # regardless of manual due date edits.
    debit_rows.sort(
        key=lambda row: (
            DEBIT_ALLOCATION_PRIORITY.get(normalize_transaction_item(row.item), 2),
            row.due_date or row.transaction_date or today,
            row.date_posted or row.transaction_date or today,
            row.id,
        )
    )

    for row in debit_rows:
        row_item_key = normalize_transaction_item(row.item)
        debit_amount = normalize_money(row.debit)
        is_billing_debit = row_item_key in BILLING_DEBIT_ITEMS

        if available_credit <= 0:
            if is_billing_debit:
                # Only mark OVERDUE if there's an explicit due_date that has passed
                desired_status = 'OVERDUE' if (row.due_date and row.due_date < today) else 'PENDING'
            else:
                desired_status = row.status or 'POSTED'
        elif available_credit >= debit_amount:
            desired_status = 'PAID'
            available_credit = normalize_money(available_credit - debit_amount)
        else:
            # Only mark OVERDUE if there's an explicit due_date that has passed
            if is_billing_debit and row.due_date and row.due_date < today:
                desired_status = 'OVERDUE'
            else:
                desired_status = 'PARTIAL'
            available_credit = Decimal('0.00')

        if row.status != desired_status:
            row.status = desired_status
            row.save(update_fields=['status'])
