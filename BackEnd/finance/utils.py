from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone

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

DEBIT_FIXED_PREFIX = [
    'INITIAL',
    'ASSESSMENT',
    'REGISTRATION',
    'RESERVATION',
]


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

    today = timezone.localdate()
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

    # Sequencing rules:
    # 1) Initial/Assessment/Registration/Reservation first.
    # 2) Monthly + Misc as one combined month stream (monthly first when same date).
    # 3) Anything else after.
    fixed_rows = []
    for item_key in DEBIT_FIXED_PREFIX:
        matched = [row for row in debit_rows if normalize_transaction_item(row.item) == item_key]
        matched.sort(
            key=lambda row: (
                row.due_date or row.transaction_date or today,
                row.date_posted or row.transaction_date or today,
                row.id,
            )
        )
        fixed_rows.extend(matched)

    installment_rows = [
        row for row in debit_rows
        if normalize_transaction_item(row.item) in {'MONTHLY', 'MISC'}
    ]
    installment_rows.sort(
        key=lambda row: (
            row.due_date or row.transaction_date or today,
            0 if normalize_transaction_item(row.item) == 'MONTHLY' else 1,
            row.date_posted or row.transaction_date or today,
            row.id,
        )
    )

    sequenced_known = set(id(row) for row in fixed_rows + installment_rows)
    remaining_rows = [row for row in debit_rows if id(row) not in sequenced_known]
    remaining_rows.sort(
        key=lambda row: (
            row.due_date or row.transaction_date or today,
            row.date_posted or row.transaction_date or today,
            row.id,
        )
    )

    sequenced_rows = fixed_rows + installment_rows + remaining_rows

    for row in sequenced_rows:
        row_item_key = normalize_transaction_item(row.item)
        debit_amount = normalize_money(row.debit)
        is_billing_debit = row_item_key in BILLING_DEBIT_ITEMS

        # Hard guard: Initial + Assessment must never regress to PARTIAL/OVERDUE
        # when admins adjust monthly due dates.
        if row_item_key in {'INITIAL', 'ASSESSMENT'}:
            if available_credit > 0:
                applied = debit_amount if available_credit >= debit_amount else available_credit
                available_credit = normalize_money(available_credit - applied)

            desired_status = 'PAID'
            if row.status != desired_status:
                row.status = desired_status
                row.save(update_fields=['status'])
            continue

        if available_credit <= 0:
            if is_billing_debit:
                # Only mark OVERDUE if there's an explicit due_date that has passed or is today.
                desired_status = 'OVERDUE' if (row.due_date and row.due_date <= today) else 'PENDING'
            else:
                desired_status = row.status or 'POSTED'
        elif available_credit >= debit_amount:
            desired_status = 'PAID'
            available_credit = normalize_money(available_credit - debit_amount)
        else:
            # Only mark OVERDUE if there's an explicit due_date that has passed or is today.
            if is_billing_debit and row.due_date and row.due_date <= today:
                desired_status = 'OVERDUE'
            else:
                desired_status = 'PARTIAL'
            available_credit = Decimal('0.00')

        if row.status != desired_status:
            row.status = desired_status
            row.save(update_fields=['status'])
