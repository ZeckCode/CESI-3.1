from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Sum
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


def get_payment_allocation_priority(item_value):
    normalized = normalize_transaction_item(item_value)
    order = {
        'INITIAL': 0,
        'ASSESSMENT': 1,
        'REGISTRATION': 2,
        'RESERVATION': 3,
        'MONTHLY': 4,
        'MISC': 5,
    }
    return order.get(normalized, 99)


def get_student_billing_rows_for_allocation(enrollment):
    rows = Transaction.objects.filter(
        enrollment=enrollment,
        entry_type='DEBIT',
    ).order_by('due_date', 'transaction_date', 'id')

    billing_rows = []
    for row in rows:
        item_key = normalize_transaction_item(row.item)
        if item_key not in BILLING_DEBIT_ITEMS:
            continue

        debit_amount = normalize_money(row.debit)
        if debit_amount <= 0:
            continue

        if str(row.status or '').upper() == 'PAID':
            continue

        billing_rows.append((row, debit_amount))

    billing_rows.sort(
        key=lambda row_data: (
            get_payment_allocation_priority(row_data[0].item),
            row_data[0].due_date or row_data[0].transaction_date or timezone.localdate(),
            0 if normalize_transaction_item(row_data[0].item) == 'MONTHLY' else 1,
            row_data[0].id,
        )
    )

    return billing_rows


def get_payment_allocation_plan_for_enrollment(enrollment, payment_amount):
    amount = normalize_money(payment_amount)
    if amount <= 0:
        return []

    existing_credit = normalize_money(
        Transaction.objects.filter(
            enrollment=enrollment,
            entry_type='CREDIT',
        ).aggregate(total=Sum('credit')).get('total') or 0
    )
    remaining = amount
    allocation = []

    for row, debit_amount in get_student_billing_rows_for_allocation(enrollment):
        if existing_credit >= debit_amount:
            existing_credit = normalize_money(existing_credit - debit_amount)
            continue

        outstanding_amount = normalize_money(debit_amount - existing_credit)
        existing_credit = Decimal('0.00')
        if remaining <= 0:
            break

        if outstanding_amount <= 0:
            continue

        applied = outstanding_amount if outstanding_amount <= remaining else remaining
        remaining = normalize_money(remaining - applied)

        allocation.append({
            'transaction_id': row.id,
            'item': normalize_transaction_item(row.item),
            'amount': float(applied),
            'due_date': row.due_date.isoformat() if row.due_date else None,
            'reference_number': row.reference_number,
            'outstanding_amount': float(outstanding_amount),
        })

    return allocation


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
    targeted_credit = {}
    debit_rows = []

    for row in rows:
        row_item_key = normalize_transaction_item(row.item)
        credit_amount = normalize_money(row.credit)

        if row.entry_type == 'CREDIT':
            if credit_amount > 0:
                if row.allocation_target_id:
                    targeted_credit[row.allocation_target_id] = normalize_money(
                        targeted_credit.get(row.allocation_target_id, Decimal('0.00')) + credit_amount
                    )
                else:
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
        targeted_amount = targeted_credit.pop(row.id, Decimal('0.00'))
        if targeted_amount > debit_amount:
            available_credit = normalize_money(available_credit + targeted_amount - debit_amount)
            targeted_amount = debit_amount
        remaining_debit = normalize_money(debit_amount - targeted_amount)

        # Hard guard: Initial + Assessment must never regress to PARTIAL/OVERDUE
        # when admins adjust monthly due dates.
        if row_item_key in {'INITIAL', 'ASSESSMENT'}:
            if available_credit > 0 and remaining_debit > 0:
                applied = remaining_debit if available_credit >= remaining_debit else available_credit
                available_credit = normalize_money(available_credit - applied)
                remaining_debit = normalize_money(remaining_debit - applied)

            desired_status = 'PAID' if remaining_debit <= 0 else 'PENDING'
            if row.status != desired_status:
                row.status = desired_status
                row.save(update_fields=['status'])
            continue

        if available_credit <= 0:
            applied_amount = targeted_amount
            if applied_amount >= debit_amount:
                desired_status = 'PAID'
            elif applied_amount > 0:
                desired_status = 'OVERDUE' if is_billing_debit and row.due_date and row.due_date <= today else 'PARTIAL'
            elif is_billing_debit:
                # Only mark OVERDUE if there's an explicit due_date that has passed or is today.
                desired_status = 'OVERDUE' if (row.due_date and row.due_date <= today) else 'PENDING'
            else:
                desired_status = row.status or 'POSTED'
        elif available_credit >= remaining_debit:
            desired_status = 'PAID'
            available_credit = normalize_money(available_credit - remaining_debit)
        else:
            applied_amount = targeted_amount + available_credit
            # Only mark OVERDUE if there's an explicit due_date that has passed or is today.
            if applied_amount > 0 and is_billing_debit and row.due_date and row.due_date <= today:
                desired_status = 'OVERDUE'
            elif applied_amount > 0:
                desired_status = 'PARTIAL'
            else:
                desired_status = 'PENDING'
            available_credit = Decimal('0.00')

        if row.status != desired_status:
            row.status = desired_status
            row.save(update_fields=['status'])
