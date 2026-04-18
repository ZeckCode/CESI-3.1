
#Reminders views.py
import logging
from datetime import timedelta

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models import Q

from django.db import IntegrityError
from django.utils import timezone
from django.db.models import Sum


from accounts.models import UserProfile
from .models import Reminder
from .serializers import ReminderSerializer
from finance.models import Transaction


from decimal import Decimal
from finance.models import Transaction, ProofOfPayment
from finance.utils import (
    BILLING_DEBIT_ITEMS,
    normalize_transaction_item,
    recompute_transaction_statuses_for_enrollment,
)
from enrollment.models import Enrollment


logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_paid_notification(request, transaction_id):
    if not is_admin(request.user):
        return Response(
            {"detail": "Only admin can send paid notifications."},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        transaction = Transaction.objects.select_related("parent", "enrollment").get(pk=transaction_id)
    except Transaction.DoesNotExist:
        return Response(
            {"detail": "Transaction not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    recipient = transaction.parent
    student_name = getattr(transaction, "student_name", "your child")
    amount = Decimal(str(transaction.credit or transaction.amount or 0))
    reference_number = getattr(transaction, "reference_number", "N/A")

    remaining_balance = Decimal("0.00")
    if transaction.enrollment:
        remaining_balance = get_enrollment_balance(transaction.enrollment)

    title = "Payment Received"
    message = (
        f"Good news! We have received your payment for {student_name}.\n"
        f"Reference No: {reference_number}\n"
        f"Amount Paid: ₱{amount}\n"
        f"Remaining Balance: ₱{remaining_balance}\n"
        f"Thank you for your payment."
    ).strip()

    reminder, created = create_reminder_once(
        recipient=recipient,
        sender=request.user,
        title=title,
        message=message,
        reminder_type="PAYMENT",
        event_type="PAYMENT_RECEIVED",
        transaction=transaction,
        reference_date=transaction.transaction_date or timezone.localdate(),
    )

    return Response(
        {
            "detail": "Payment notification sent successfully." if created else "Payment notification already exists.",
            "reminder": ReminderSerializer(reminder).data if reminder else None,
            "created": created,
        },
        status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_onsite_payment_notification(request, transaction_id):
    """Send payment notification to student for onsite payment"""
    if not is_admin(request.user):
        return Response(
            {"detail": "Only admin can send payment notifications."},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        transaction = Transaction.objects.select_related("parent", "enrollment").get(pk=transaction_id)
    except Transaction.DoesNotExist:
        return Response(
            {"detail": "Transaction not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get student email
    student_email = _get_student_email(transaction)
    if not student_email:
        return Response(
            {"detail": "Student email not found."},
            status=status.HTTP_400_BAD_REQUEST
        )

    student_name = getattr(transaction, "student_name", "Student")
    amount = Decimal(str(transaction.credit or transaction.amount or 0))
    reference_number = getattr(transaction, "reference_number", "N/A")
    payment_method = getattr(transaction, "payment_method", "Onsite")

    title = "Payment Confirmation - Onsite Payment Received"
    message = (
        f"Dear {student_name},\n\n"
        f"Thank you for your payment made at our school office.\n\n"
        f"Payment Details:\n"
        f"Reference Number: {reference_number}\n"
        f"Amount Paid: ₱{amount}\n"
        f"Payment Method: {payment_method}\n"
        f"Payment Date: {transaction.transaction_date or 'Today'}\n\n"
        f"Your payment has been successfully recorded in our system.\n"
        f"Please keep this reference number for your records.\n\n"
        f"You can view your updated account balance and payment history in the Student Portal.\n\n"
        f"Thank you for your prompt payment!\n\n"
        f"Best regards,\n"
        f"Caloocan Evangelical School Inc.\n"
        f"Finance Office"
    ).strip()

    student_recipient = _resolve_student_recipient(student_number=getattr(transaction, "student_number", None))
    
    reminder, created = create_reminder_once(
        recipient=student_recipient,
        sender=request.user,
        title=title,
        message=message,
        reminder_type="PAYMENT",
        event_type="PAYMENT_RECEIVED_ONSITE",
        transaction=transaction,
        reference_date=transaction.transaction_date or timezone.localdate(),
    )

    # Send email to student
    emailed = _send_onsite_payment_notification_email(
        student_email=student_email,
        student_name=student_name,
        title=title,
        message=message,
    )

    return Response(
        {
            "detail": "Onsite payment notification sent to student successfully." if created else "Onsite payment notification already exists.",
            "reminder": ReminderSerializer(reminder).data if reminder else None,
            "created": created,
            "emailed": emailed,
        },
        status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED,
    )


User = get_user_model()


def is_admin(user):
    return user.is_authenticated and (
        getattr(user, "is_staff", False)
        or getattr(user, "role", "").upper() == "ADMIN"
    )


def _get_student_email(transaction):
    """Get student email from transaction enrollment or student number"""
    # Try to get from enrollment relationship
    if transaction.enrollment and transaction.enrollment.student:
        student_email = getattr(transaction.enrollment.student, "email", "")
        if student_email:
            return student_email
    
    # Try to get from student number
    student_number = getattr(transaction, "student_number", None)
    if student_number:
        try:
            profile = UserProfile.objects.select_related("user").get(student_number=student_number)
            return getattr(profile.user, "email", "")
        except UserProfile.DoesNotExist:
            pass
    
    return None


def _send_onsite_payment_notification_email(*, student_email, student_name, title, message):
    """Send onsite payment notification email to student"""
    if not student_email:
        return False

    try:
        send_mail(
            subject=title,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
            recipient_list=[student_email],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception("Failed to send onsite payment notification email to %s", student_email)
        return False


def get_enrollment_balance(enrollment):
    totals = Transaction.objects.filter(enrollment=enrollment).aggregate(
        total_debit=Sum("debit"),
        total_credit=Sum("credit"),
    )
    total_debit = Decimal(str(totals.get("total_debit") or 0))
    total_credit = Decimal(str(totals.get("total_credit") or 0))
    balance = total_debit - total_credit
    return balance if balance > 0 else Decimal("0.00")


def can_send_reminder_for_transaction(transaction):
    """
    Check if a transaction is eligible to receive a payment reminder.
    Requirements:
    1. Must be a DEBIT entry
    2. Status must be PENDING, DUE_TODAY, OVERDUE, or PARTIAL (not PAID)
    3. Must have outstanding balance (debit > credit)
    4. Due date must be <= today
    """
    if not transaction:
        return False
    
    # Must be DEBIT
    if getattr(transaction, "entry_type", "") != "DEBIT":
        return False

    # Must be an unpaid billing debit row, not non-billing adjustments.
    tx_item = normalize_transaction_item(getattr(transaction, "item", ""))
    if tx_item not in BILLING_DEBIT_ITEMS:
        return False
    
    # Compute effective status from due_date so due-today rows can be handled explicitly.
    status = str(getattr(transaction, "status", "") or "").upper()
    due_date = getattr(transaction, "due_date", None)
    from datetime import date as date_class
    try:
        if due_date:
            due_date_obj = due_date if isinstance(due_date, date_class) else date_class.fromisoformat(str(due_date))
            today = timezone.localdate()
            if status == "PENDING":
                if due_date_obj == today:
                    status = "DUE_TODAY"
                elif due_date_obj < today:
                    status = "OVERDUE"
    except (ValueError, TypeError):
        pass
    
    # Status must be reminder-eligible.
    if status not in ["PENDING", "DUE_TODAY", "OVERDUE", "PARTIAL"]:
        return False
    
    # Must have outstanding balance
    debit_amount = Decimal(str(getattr(transaction, "debit", 0) or 0))
    credit_amount = Decimal(str(getattr(transaction, "credit", 0) or 0))
    outstanding = debit_amount - credit_amount
    if outstanding <= 0:
        return False
    
    # Due date must be <= today
    due_date = getattr(transaction, "due_date", None)
    if not due_date:
        return False
    
    try:
        due_date_obj = due_date if isinstance(due_date, date_class) else date_class.fromisoformat(str(due_date))
        today = timezone.localdate()
        if due_date_obj > today:
            return False
    except (ValueError, TypeError):
        return False
    
    return True


def _refresh_ledger_statuses_for_transactions(transactions):
    enrollment_ids = {
        tx.enrollment_id for tx in transactions if getattr(tx, "enrollment_id", None)
    }

    if not enrollment_ids:
        return

    enrollments = Enrollment.objects.filter(id__in=enrollment_ids)
    for enrollment in enrollments:
        recompute_transaction_statuses_for_enrollment(enrollment)


def _resolve_best_reminder_target(transaction, today):
    if not transaction:
        return None

    if transaction.enrollment_id:
        recompute_transaction_statuses_for_enrollment(transaction.enrollment)

        candidates = list(
            Transaction.objects.select_related("parent", "enrollment")
            .filter(
                enrollment=transaction.enrollment,
                entry_type="DEBIT",
                due_date__isnull=False,
                parent__isnull=False,
                status__in=["PENDING", "DUE_TODAY", "OVERDUE", "PARTIAL"],
            )
            .order_by("due_date", "id")
        )
        return _nearest_due_transaction(candidates, today)

    candidates = list(
        Transaction.objects.select_related("parent", "enrollment")
        .filter(
            parent=transaction.parent,
            student_name=transaction.student_name,
            entry_type="DEBIT",
            due_date__isnull=False,
            status__in=["PENDING", "DUE_TODAY", "OVERDUE", "PARTIAL"],
        )
        .order_by("due_date", "id")
    )

    return _nearest_due_transaction(candidates, today)


def create_reminder_once(
    *,
    recipient,
    sender,
    title,
    message,
    reminder_type,
    event_type,
    transaction=None,
    proof_of_payment=None,
    reference_date=None,
):
    try:
        reminder, created = Reminder.objects.get_or_create(
            recipient=recipient,
            transaction=transaction,
            event_type=event_type,
            reference_date=reference_date,
            defaults={
                "sender": sender,
                "title": title,
                "message": message,
                "reminder_type": reminder_type,
                "proof_of_payment": proof_of_payment,
                "is_read": False,
            },
        )
    except IntegrityError:
        reminder = Reminder.objects.filter(
            recipient=recipient,
            transaction=transaction,
            event_type=event_type,
            reference_date=reference_date,
        ).first()
        created = False

    return reminder, created


def _send_payment_reminder_email(*, recipient, title, message):
    recipient_email = getattr(recipient, "email", "") if recipient else ""
    if not recipient_email:
        return False

    try:
        send_mail(
            subject=title,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception("Failed to send payment reminder email to %s", recipient_email)
        return False


def _build_upcoming_payment_reminder_email_message(*, transaction, due_date, days_before):
    student_name = getattr(transaction, "student_name", "your child")
    reference_number = getattr(transaction, "reference_number", "N/A")
    transaction_type = getattr(transaction, "transaction_type", "Payment")
    amount_due = Decimal(str(transaction.debit or transaction.amount or 0))

    return "\n".join(
        [
            "Greetings!",
            "",
            "Dear Parent/Guardian,",
            "",
            f"This is a friendly reminder that {student_name}'s {transaction_type.lower()} bill is due in {days_before} day(s).",
            "Please settle the balance before the due date to avoid being marked overdue.",
            "",
            "Please see the account details below:",
            f"Student Name     : {student_name}",
            f"Billing Category  : {transaction_type}",
            f"Reference Number  : {reference_number}",
            f"Amount Due        : ₱{amount_due}",
            f"Due Date          : {due_date}",
            "",
            "You may review your full ledger and payment history in the Student Portal.",
            "If payment has already been made, please allow time for posting and disregard this notice once updated.",
            "",
            "Sincerely,",
            "Caloocan Evangelical School Inc.",
            "Admissions Office",
        ]
    ).strip()


def send_upcoming_payment_due_reminders(*, days_before=7, sender=None, target_date=None):
    # Auto reminder policy: send exactly 1 week before nearest upcoming due date.
    days_before = 7
    today = timezone.localdate()
    reminder_date = target_date or (today + timedelta(days=days_before))

    base_transactions = (
        Transaction.objects.select_related("parent", "enrollment")
        .filter(
            entry_type="DEBIT",
            due_date__isnull=False,
            transaction_type="TUITION",
            parent__isnull=False,
            status__in=["PENDING", "DUE_TODAY", "OVERDUE", "PARTIAL"],
        )
        .exclude(status="PAID")
        .order_by("due_date", "id")
    )

    grouped = {}
    for tx in base_transactions:
        if _compute_outstanding_balance(tx) <= 0:
            continue
        key = tx.enrollment_id or f"{tx.parent_id}:{(tx.student_number_snapshot or tx.student_name or '').strip().lower()}"
        grouped.setdefault(key, []).append(tx)

    transactions = []
    for tx_group in grouped.values():
        nearest = _nearest_due_transaction(tx_group, today)
        if not nearest:
            continue

        # Trigger only when the nearest upcoming due date is exactly 7 days away.
        if nearest.due_date == reminder_date:
            transactions.append(nearest)

    created_count = 0
    duplicate_count = 0
    emailed_count = 0
    missing_email_count = 0
    email_failed_count = 0
    skipped_count = 0

    for transaction in transactions:
        recipient = transaction.parent
        if not recipient:
            skipped_count += 1
            continue

        if getattr(recipient, "role", "").upper() != "PARENT_STUDENT":
            skipped_count += 1
            continue

        title = f"Upcoming Payment Due Notice - {getattr(transaction, 'student_name', 'Student')}"
        message = _build_upcoming_payment_reminder_email_message(
            transaction=transaction,
            due_date=reminder_date,
            days_before=days_before,
        )

        reminder, created = create_reminder_once(
            recipient=recipient,
            sender=sender,
            title=title,
            message=message,
            reminder_type="PAYMENT",
            event_type="PAYMENT_DUE",
            transaction=transaction,
            reference_date=reminder_date,
        )

        if created:
            created_count += 1
            emailed = _send_payment_reminder_email(
                recipient=recipient,
                title=title,
                message=message,
            )
            if emailed:
                emailed_count += 1
            elif not getattr(recipient, "email", ""):
                missing_email_count += 1
            else:
                email_failed_count += 1
        else:
            duplicate_count += 1

    return {
        "target_date": reminder_date,
        "created_count": created_count,
        "emailed_count": emailed_count,
        "missing_email_count": missing_email_count,
        "email_failed_count": email_failed_count,
        "duplicate_count": duplicate_count,
        "skipped_count": skipped_count,
    }


def _build_payment_reminder_email_message(
    *,
    transaction,
    amount,
    status_value,
    due_date,
    body,
    ledger_total_debit=None,
    ledger_total_paid=None,
    ledger_total_balance=None,
):
    student_name = getattr(transaction, "student_name", "your child")
    reference_number = getattr(transaction, "reference_number", "N/A")
    transaction_type = getattr(transaction, "transaction_type", "Payment")

    amount_due = Decimal(str(amount or transaction.debit or transaction.amount or 0))
    balance_due = Decimal(str(ledger_total_balance if ledger_total_balance is not None else 0))
    if balance_due <= 0:
        balance_due = Decimal(str(transaction.debit or transaction.amount or 0)) - Decimal(str(transaction.credit or 0))
        balance_due = balance_due if balance_due > 0 else Decimal("0.00")

    total_billed = Decimal(str(ledger_total_debit if ledger_total_debit is not None else 0))
    total_paid = Decimal(str(ledger_total_paid if ledger_total_paid is not None else 0))

    status_text = str(status_value).upper()
    lines = [
        "Greetings!",
        "",
        "Dear Parent/Guardian,",
        "",
        body,
        "",
        "Please see the account details below:",
        f"Student Name     : {student_name}",
        f"Billing Category : {transaction_type}",
        f"Reference Number : {reference_number}",
        f"Current Billing Due: ₱{amount_due}",
        f"Total Billed     : ₱{total_billed}",
        f"Total Paid       : ₱{total_paid}",
        f"Balance Remaining: ₱{balance_due}",
        f"Current Status   : {status_text}",
    ]

    if due_date:
        lines.append(f"Due Date         : {due_date}")

    if status_text == "OVERDUE":
        lines.extend([
            "",
            "Our records indicate that this account is already overdue.",
            "Kindly settle the outstanding balance at the soonest possible time.",
        ])
    elif status_text == "DUE_TODAY":
        lines.extend([
            "",
            "This account is due today.",
            "Kindly settle the outstanding balance today to avoid being marked overdue.",
        ])
    else:
        lines.extend([
            "",
            "This account is currently pending.",
            "Kindly settle this before the due date to avoid being marked as overdue.",
        ])

    lines.extend([
        "",
        "You may review your full ledger and payment history in the Student Portal.",
        "If payment has already been made, please allow time for posting and disregard this notice once updated.",
        "",
        "Sincerely,",
        "Caloocan Evangelical School Inc.",
        "Admissions Office",
    ])

    return "\n".join(lines).strip()


def _compute_outstanding_balance(transaction):
    status_upper = str(getattr(transaction, "status", "") or "").upper()
    if status_upper == "PAID":
        return Decimal("0.00")

    if str(getattr(transaction, "entry_type", "") or "").upper() == "CREDIT":
        return Decimal("0.00")

    debit_amount = Decimal(str(getattr(transaction, "debit", 0) or getattr(transaction, "amount", 0) or 0))
    credit_amount = Decimal(str(getattr(transaction, "credit", 0) or 0))
    outstanding = debit_amount - credit_amount
    return outstanding if outstanding > 0 else Decimal("0.00")


def _resolve_payment_notice_type(transaction, today=None):
    today = today or timezone.localdate()
    due_date = getattr(transaction, "due_date", None)
    status_upper = str(getattr(transaction, "status", "") or "").upper()

    if status_upper == "DUE_TODAY" or (due_date and due_date == today):
        return "PAYMENT_DUE", "DUE_TODAY", "Due Today"

    if status_upper == "OVERDUE" or (due_date and due_date < today):
        return "PAYMENT_OVERDUE", "OVERDUE", "Overdue"

    if due_date and due_date > today:
        return "PAYMENT_DUE", "PENDING", "Upcoming Payment Due"

    return "PAYMENT_DUE", "PENDING", "Payment Due"


def _resolve_student_recipient(student_id=None, student_number=None):
    profiles = UserProfile.objects.select_related("user")

    if student_id not in (None, ""):
        profile = profiles.filter(user_id=student_id).first()
        if profile and profile.user:
            return profile.user, profile

    normalized_number = str(student_number or "").strip()
    if normalized_number:
        profile = profiles.filter(student_number__iexact=normalized_number).first()
        if profile and profile.user:
            return profile.user, profile

    return None, None


def _compute_parent_student_balance(parent, student_name):
    totals = Transaction.objects.filter(
        parent=parent,
        student_name=student_name,
    ).aggregate(
        total_debit=Sum("debit"),
        total_credit=Sum("credit"),
    )
    total_debit = Decimal(str(totals.get("total_debit") or 0))
    total_credit = Decimal(str(totals.get("total_credit") or 0))
    balance = total_debit - total_credit
    return balance if balance > 0 else Decimal("0.00")


def _compute_ledger_totals_for_transaction(transaction):
    if not transaction:
        return Decimal("0.00"), Decimal("0.00"), Decimal("0.00")

    if transaction.enrollment_id:
        totals = Transaction.objects.filter(enrollment=transaction.enrollment).aggregate(
            total_debit=Sum("debit"),
            total_credit=Sum("credit"),
        )
    else:
        totals = Transaction.objects.filter(
            parent=transaction.parent,
            student_name=transaction.student_name,
        ).aggregate(
            total_debit=Sum("debit"),
            total_credit=Sum("credit"),
        )

    total_debit = Decimal(str(totals.get("total_debit") or 0))
    total_credit = Decimal(str(totals.get("total_credit") or 0))
    balance = total_debit - total_credit
    payable_balance = balance if balance > 0 else Decimal("0.00")
    return total_debit, total_credit, payable_balance


def _nearest_due_transaction(transactions, today):
    due_today = [tx for tx in transactions if tx.due_date and tx.due_date == today]
    if due_today:
        return min(due_today, key=lambda tx: tx.id)

    overdue = [tx for tx in transactions if tx.due_date and tx.due_date < today]
    if overdue:
        return max(overdue, key=lambda tx: (tx.due_date, tx.id))

    upcoming = [tx for tx in transactions if tx.due_date and tx.due_date > today]
    if upcoming:
        return min(upcoming, key=lambda tx: (tx.due_date, tx.id))

    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payment_ledger_nearest_due(request):
    if not is_admin(request.user):
        return Response(
            {"detail": "Only admin can view payment reminder ledger."},
            status=status.HTTP_403_FORBIDDEN,
        )

    today = timezone.localdate()
    prefetch_qs = list(
        Transaction.objects.select_related("parent", "enrollment")
        .filter(
            entry_type="DEBIT",
            parent__isnull=False,
            due_date__isnull=False,
        )
        .order_by("due_date", "id")
    )

    _refresh_ledger_statuses_for_transactions(prefetch_qs)

    base_qs = (
        Transaction.objects.select_related("parent", "enrollment")
        .filter(
            entry_type="DEBIT",
            parent__isnull=False,
            due_date__isnull=False,
        )
        .exclude(status="PAID")
        .order_by("due_date", "id")
    )

    grouped = {}
    for tx in base_qs:
        tx_outstanding = _compute_outstanding_balance(tx)
        if tx_outstanding <= 0:
            continue

        key = tx.enrollment_id or f"{tx.parent_id}:{(tx.student_number_snapshot or tx.student_name or '').strip().lower()}"
        grouped.setdefault(key, []).append(tx)

    rows = []
    for tx_group in grouped.values():
        chosen = _nearest_due_transaction(tx_group, today)
        if not chosen:
            continue

        ledger_total_debit, ledger_total_paid, remaining_balance = _compute_ledger_totals_for_transaction(chosen)

        is_paid_already = remaining_balance <= 0 or _compute_outstanding_balance(chosen) <= 0

        due_date = chosen.due_date
        if is_paid_already:
            due_state = "paid"
        elif due_date < today:
            due_state = "overdue"
        elif due_date == today:
            due_state = "due_today"
        else:
            due_state = "upcoming"

        row_payload = (
            {
                "student_name": chosen.student_name or "—",
                "student_number": chosen.student_number_snapshot or "",
                "parent_name": chosen.parent.email or chosen.parent.username,
                "enrollment_id": chosen.enrollment_id,
                "transaction_id": chosen.id,
                "reference_number": chosen.reference_number,
                "transaction_type": chosen.transaction_type,
                "item": chosen.item,
                "status": chosen.status,
                "due_date": due_date,
                "amount_to_pay": chosen.amount,
                "outstanding_balance": _compute_outstanding_balance(chosen),
                "remaining_balance": remaining_balance,
                "is_paid_already": is_paid_already,
                "payment_info": "Paid already" if is_paid_already else "With remaining balance",
                "due_state": due_state,
                "can_send_payment_reminder": (not is_paid_already) and can_send_reminder_for_transaction(chosen),
            }
        )
        rows.append(row_payload)

        logger.info(
            "[PAYMENT_REMINDER_CHECK] ledger_row tx_id=%s student=%s due_state=%s can_send=%s tx_debit=%s tx_credit=%s tx_outstanding=%s ledger_total_debit=%s ledger_total_paid=%s ledger_total_balance=%s",
            chosen.id,
            chosen.student_name,
            due_state,
            row_payload["can_send_payment_reminder"],
            getattr(chosen, "debit", None),
            getattr(chosen, "credit", None),
            row_payload["outstanding_balance"],
            ledger_total_debit,
            ledger_total_paid,
            remaining_balance,
        )

    rows.sort(key=lambda row: (row["due_date"], row["student_name"].lower()))

    overdue_transactions = sum(
        1
        for tx in prefetch_qs
        if getattr(tx, "entry_type", "") == "DEBIT"
        and _compute_outstanding_balance(tx) > 0
        and getattr(tx, "due_date", None)
        and tx.due_date < today
    )
    due_today_transactions = sum(
        1
        for tx in prefetch_qs
        if getattr(tx, "entry_type", "") == "DEBIT"
        and _compute_outstanding_balance(tx) > 0
        and getattr(tx, "due_date", None)
        and tx.due_date == today
    )
    upcoming_transactions = sum(
        1
        for tx in prefetch_qs
        if getattr(tx, "entry_type", "") == "DEBIT"
        and _compute_outstanding_balance(tx) > 0
        and getattr(tx, "due_date", None)
        and tx.due_date > today
    )
    paid_transactions = sum(
        1
        for tx in prefetch_qs
        if getattr(tx, "entry_type", "") == "DEBIT"
        and _compute_outstanding_balance(tx) <= 0
    )
    logger.info(
        "[PAYMENT_REMINDER_CHECK] ledger_nearest_due rows=%s overdue=%s due_today=%s upcoming=%s paid=%s",
        len(rows),
        sum(1 for row in rows if row.get("due_state") == "overdue"),
        sum(1 for row in rows if row.get("due_state") == "due_today"),
        sum(1 for row in rows if row.get("due_state") == "upcoming"),
        sum(1 for row in rows if row.get("due_state") == "paid"),
    )
    return Response(
        {
            "rows": rows,
            "summary": {
                "overdue_transactions": overdue_transactions,
                "due_today_transactions": due_today_transactions,
                "upcoming_transactions": upcoming_transactions,
                "paid_transactions": paid_transactions,
                "visible_rows": len(rows),
            },
        }
    )


class ReminderListCreateView(generics.ListCreateAPIView):
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Reminder.objects.select_related(
            "recipient", "sender", "transaction", "proof_of_payment"
        ).all()

        reminder_type = self.request.query_params.get("type")
        normalized_type = reminder_type.upper() if reminder_type else None
        recipient_id = self.request.query_params.get("recipient")
        is_read = self.request.query_params.get("is_read")

        if reminder_type:
            if normalized_type == "PAYMENT" and not is_admin(self.request.user):
                # Backward-compatible bell/API behavior: PAYMENT feed also includes
                # star-award notifications sent by teachers.
                star_filter = Q(reminder_type="PERFORMANCE") & (
                    Q(title__icontains="star") | Q(message__icontains="given you a star")
                )
                queryset = queryset.filter(Q(reminder_type="PAYMENT") | star_filter)
            else:
                queryset = queryset.filter(reminder_type=normalized_type)

        if recipient_id:
            queryset = queryset.filter(recipient_id=recipient_id)

        if is_read is not None:
            if is_read.lower() == "true":
                queryset = queryset.filter(is_read=True)
            elif is_read.lower() == "false":
                queryset = queryset.filter(is_read=False)

        if is_admin(self.request.user):
            # Admin dashboard needs visibility for payment reminder monitoring.
            if normalized_type == "PAYMENT":
                return queryset

            # Keep other reminder inbox feeds hidden from admin users.
            return queryset.none()

        role = getattr(self.request.user, "role", "").upper()

        # Teacher should see PERFORMANCE reminders they SENT
        if role == "TEACHER" and normalized_type == "PERFORMANCE":
            return queryset.filter(sender=self.request.user)

        # Everyone else sees reminders they RECEIVED
        return queryset.filter(recipient=self.request.user)

        

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)


class ReminderDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Reminder.objects.select_related(
            "recipient", "sender", "transaction", "proof_of_payment"
        ).all()

        if is_admin(self.request.user):
            return queryset.none()

        role = getattr(self.request.user, "role", "").upper()
        if role == "TEACHER":
            # Teachers can operate on their sender-owned performance reminders.
            return queryset.filter(
                Q(recipient=self.request.user)
                | Q(sender=self.request.user, reminder_type="PERFORMANCE")
            )

        return queryset.filter(recipient=self.request.user)



@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_payment_reminder(request, transaction_id):
    if not is_admin(request.user):
        return Response(
            {"detail": "Only admin can send payment reminders."},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        transaction = Transaction.objects.select_related("parent").get(pk=transaction_id)
    except Transaction.DoesNotExist:
        return Response(
            {"detail": "Transaction not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    today = timezone.localdate()
    target_transaction = _resolve_best_reminder_target(transaction, today=today)
    if target_transaction:
        if target_transaction.id != transaction.id:
            logger.info(
                "[PAYMENT_REMINDER_CHECK] retarget single tx request_id=%s target_id=%s enrollment_id=%s status=%s due_date=%s",
                transaction.id,
                target_transaction.id,
                target_transaction.enrollment_id,
                target_transaction.status,
                target_transaction.due_date,
            )
        transaction = target_transaction

    recipient = transaction.parent
    
    # Ensure transaction status is up-to-date before eligibility check
    if transaction.enrollment_id:
        recompute_transaction_statuses_for_enrollment(transaction.enrollment)
        # Refresh from DB to get updated status
        transaction.refresh_from_db()
    
    # Check if transaction is eligible for reminder
    if not can_send_reminder_for_transaction(transaction):
        outstanding_balance = _compute_outstanding_balance(transaction)
        tx_status = str(getattr(transaction, "status", "") or "").upper()
        ledger_total_debit, ledger_total_paid, ledger_total_balance = _compute_ledger_totals_for_transaction(transaction)
        logger.warning(
            "[PAYMENT_REMINDER_CHECK] blocked single tx_id=%s status=%s due_date=%s debit=%s credit=%s outstanding=%s ledger_total_debit=%s ledger_total_paid=%s ledger_total_balance=%s",
            transaction.id,
            tx_status,
            getattr(transaction, "due_date", None),
            getattr(transaction, "debit", None),
            getattr(transaction, "credit", None),
            outstanding_balance,
            ledger_total_debit,
            ledger_total_paid,
            ledger_total_balance,
        )
        
        if outstanding_balance <= 0:
            return Response(
                {"detail": "This transaction has no outstanding balance."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        elif tx_status not in ["PENDING", "DUE_TODAY", "OVERDUE", "PARTIAL"]:
            return Response(
                {"detail": f"Cannot send reminder for {tx_status} status. Only PENDING, DUE_TODAY, OVERDUE, and PARTIAL transactions can receive reminders."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        else:
            return Response(
                {"detail": "This transaction is not eligible for payment reminders."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    outstanding_balance = _compute_outstanding_balance(transaction)

    event_type, status_value, notice_label = _resolve_payment_notice_type(transaction, today=today)
    due_date = getattr(transaction, "due_date", None)
    transaction_type = getattr(transaction, "transaction_type", "Payment")
    title = f"{notice_label} Notice - {getattr(transaction, 'student_name', 'Student')}"

    if status_value == "OVERDUE":
        body = (
            "This is from Caloocan Evangelical School Inc. to inform you that your student's "
            "account has not yet been fully settled."
        )
    elif status_value == "DUE_TODAY":
        body = (
            "This is from Caloocan Evangelical School Inc. to remind you that your student's "
            "account is due today."
        )
    elif due_date and due_date > today:
        body = (
            "This is a friendly reminder from Caloocan Evangelical School Inc. that your student's "
            f"{transaction_type} account is coming due soon."
        )
    else:
        body = (
            "This is from Caloocan Evangelical School Inc. to remind you that your student's "
            "account is pending and due for settlement."
        )

    ledger_total_debit, ledger_total_paid, ledger_total_balance = _compute_ledger_totals_for_transaction(transaction)

    message = _build_payment_reminder_email_message(
        transaction=transaction,
        amount=outstanding_balance,
        status_value=status_value,
        due_date=due_date,
        body=body,
        ledger_total_debit=ledger_total_debit,
        ledger_total_paid=ledger_total_paid,
        ledger_total_balance=ledger_total_balance,
    )

    reminder, created = create_reminder_once(
        recipient=recipient,
        sender=request.user,
        title=title,
        message=message,
        reminder_type="PAYMENT",
        event_type=event_type,
        transaction=transaction,
        reference_date=due_date or timezone.localdate(),
    )

    emailed = _send_payment_reminder_email(recipient=recipient, title=title, message=message)
    logger.info(
        "[PAYMENT_REMINDER_CHECK] sent single tx_id=%s created=%s emailed=%s status=%s due_date=%s outstanding=%s ledger_total_debit=%s ledger_total_paid=%s ledger_total_balance=%s",
        transaction.id,
        created,
        emailed,
        status_value,
        due_date,
        outstanding_balance,
        ledger_total_debit,
        ledger_total_paid,
        ledger_total_balance,
    )

    return Response(
        {
            "detail": "Payment reminder emailed successfully." if emailed else "Reminder saved, but email could not be sent.",
            "reminder": ReminderSerializer(reminder).data,
            "created": created,
            "emailed": emailed,
        },
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )
    
@api_view(["POST", "PATCH"])
@permission_classes([IsAuthenticated])
def mark_reminder_as_read(request, pk):
    role = getattr(request.user, "role", "").upper()

    reminder_qs = Reminder.objects.filter(pk=pk, recipient=request.user)
    if role == "TEACHER":
        reminder_qs = Reminder.objects.filter(pk=pk).filter(
            Q(recipient=request.user)
            | Q(sender=request.user, reminder_type="PERFORMANCE")
        )

    reminder = reminder_qs.first()
    if not reminder:
        return Response({"detail": "Reminder not found."}, status=404)

    reminder.is_read = True
    reminder.save(update_fields=["is_read"])

    return Response({"success": True, "message": "Marked as read"})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_bulk_payment_reminders(request):
    if not is_admin(request.user):
        return Response(
            {"detail": "Only admin can send bulk payment reminders."},
            status=status.HTTP_403_FORBIDDEN,
        )

    today = timezone.localdate()
    transactions = Transaction.objects.select_related("parent", "enrollment").filter(
        entry_type="DEBIT",
        parent__isnull=False,
        status__in=["PENDING", "DUE_TODAY", "OVERDUE", "PARTIAL"],
        due_date__isnull=False,
        due_date__lte=today,
    )

    _refresh_ledger_statuses_for_transactions(transactions)

    selected_ids = request.data.get("transaction_ids") if hasattr(request, "data") else None
    if selected_ids is not None:
        if not isinstance(selected_ids, list):
            return Response(
                {"detail": "transaction_ids must be an array of transaction IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized_ids = []
        for raw_id in selected_ids:
            try:
                normalized_ids.append(int(raw_id))
            except (TypeError, ValueError):
                continue

        if not normalized_ids:
            return Response(
                {"detail": "No valid transaction IDs were provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        transactions = transactions.filter(id__in=normalized_ids)

    processed_count = 0
    created_count = 0
    duplicate_count = 0
    emailed_count = 0
    missing_email_count = 0
    email_failed_count = 0
    skipped_count = 0
    error_count = 0

    processed_target_ids = set()

    for transaction in transactions:
        processed_count += 1
        try:
            target_transaction = _resolve_best_reminder_target(transaction, today=today)
            if target_transaction:
                transaction = target_transaction

            if transaction.id in processed_target_ids:
                duplicate_count += 1
                continue
            processed_target_ids.add(transaction.id)

            # Extra validation to ensure transaction is still eligible
            if not can_send_reminder_for_transaction(transaction):
                ledger_total_debit, ledger_total_paid, ledger_total_balance = _compute_ledger_totals_for_transaction(transaction)
                logger.warning(
                    "[PAYMENT_REMINDER_CHECK] blocked bulk tx_id=%s status=%s due_date=%s debit=%s credit=%s ledger_total_debit=%s ledger_total_paid=%s ledger_total_balance=%s",
                    transaction.id,
                    getattr(transaction, "status", None),
                    getattr(transaction, "due_date", None),
                    getattr(transaction, "debit", None),
                    getattr(transaction, "credit", None),
                    ledger_total_debit,
                    ledger_total_paid,
                    ledger_total_balance,
                )
                skipped_count += 1
                continue
            
            recipient = transaction.parent
            outstanding_balance = _compute_outstanding_balance(transaction)
            if outstanding_balance <= 0:
                skipped_count += 1
                continue

            due_date = getattr(transaction, "due_date", None)
            transaction_type = getattr(transaction, "transaction_type", "Payment")
            event_type, status_value, notice_label = _resolve_payment_notice_type(transaction, today=today)
            title = f"{notice_label} Notice - {getattr(transaction, 'student_name', 'Student')}"

            if status_value == "OVERDUE":
                body = (
                    "This is from Caloocan Evangelical School Inc. to inform you that your student's "
                    f"{transaction_type} account has not yet been fully settled."
                )
            elif status_value == "DUE_TODAY":
                body = (
                    "This is from Caloocan Evangelical School Inc. to remind you that your student's "
                    f"{transaction_type} account is due today."
                )
            else:
                body = (
                    "This is from Caloocan Evangelical School Inc. to remind you that your student's "
                    f"{transaction_type} account is pending and due for settlement."
                )

            ledger_total_debit, ledger_total_paid, ledger_total_balance = _compute_ledger_totals_for_transaction(transaction)

            email_message = _build_payment_reminder_email_message(
                transaction=transaction,
                amount=outstanding_balance,
                status_value=status_value,
                due_date=due_date,
                body=body,
                ledger_total_debit=ledger_total_debit,
                ledger_total_paid=ledger_total_paid,
                ledger_total_balance=ledger_total_balance,
            )

            reminder, created = create_reminder_once(
                recipient=recipient,
                sender=request.user,
                title=title,
                message=email_message,
                reminder_type="PAYMENT",
                event_type=event_type,
                transaction=transaction,
                reference_date=due_date or timezone.localdate(),
            )

            if created:
                created_count += 1
            else:
                duplicate_count += 1

            emailed = _send_payment_reminder_email(
                recipient=recipient,
                title=title,
                message=email_message,
            )
            if emailed:
                emailed_count += 1
            elif not getattr(recipient, "email", ""):
                missing_email_count += 1
            else:
                email_failed_count += 1
        except Exception:
            error_count += 1
            logger.exception(
                "Failed bulk reminder for transaction_id=%s",
                getattr(transaction, "id", None),
            )

    return Response(
        {
            "detail": (
                f"{processed_count} transaction(s) processed, "
                f"{created_count} reminder record(s) saved, "
                f"{emailed_count} email(s) sent, "
                f"{missing_email_count} skipped for missing email, "
                f"{email_failed_count} email(s) failed, "
                f"{duplicate_count} skipped as duplicates, "
                f"{skipped_count} skipped with no outstanding balance, "
                f"{error_count} processing error(s)."
            )
        },
        status=status.HTTP_200_OK,
    )
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_performance_reminder(request):
    if getattr(request.user, "role", "").upper() != "TEACHER":
        return Response({"detail": "Only teachers can send performance reminders."}, status=403)

    student_id = request.data.get("student_id")
    student_number = request.data.get("student_number")
    student_name = request.data.get("student_name")
    issue = request.data.get("issue")
    quarter = request.data.get("quarter")
    quarter_grade = request.data.get("quarter_grade")
    attendance_pct = request.data.get("attendance_pct")

    if not student_id and not student_number:
        return Response({"detail": "student_id or student_number is required."}, status=400)

    recipient, profile = _resolve_student_recipient(student_id, student_number)
    if not recipient:
        return Response({"detail": "Student profile not found."}, status=404)

    if not student_name and profile:
        student_name = " ".join(
            p for p in [profile.student_first_name or "", profile.student_last_name or ""] if p
        ).strip() or getattr(recipient, "username", "the student")

    details = []
    if quarter_grade is not None:
        details.append(f"Current quarter grade: {quarter_grade}.")
    if attendance_pct is not None:
        details.append(f"Attendance: {attendance_pct}%.")
    if issue:
        details.append(f"Issue: {issue}.")

    message = (
        f"Performance reminder for {student_name or 'the student'} for Quarter {quarter}. "
        + " ".join(details)
        + " Please review the student's academic standing and provide support as needed."
    ).strip()

    reminder = Reminder.objects.create(
        recipient=recipient,
        sender=request.user,
        title="Performance Reminder",
        message=message,
        reminder_type="PERFORMANCE",
        is_read=False,
        event_type="PERFORMANCE_ALERT",
    )
    print("[PERFORMANCE REMINDER SENT]")
    print("Reminder created:")
    print("Recipient:", recipient.username)
    print("Title: Performance Reminder")
    print("Message:", message)
    
    return Response(
        {
            "detail": "Performance reminder sent successfully.",
            "reminder": ReminderSerializer(reminder).data,
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_star_notification(request):
    if getattr(request.user, "role", "").upper() != "TEACHER":
        return Response({"detail": "Only teachers can send stars."}, status=403)

    student_id = request.data.get("student_id")
    student_number = request.data.get("student_number")
    student_name = request.data.get("student_name")
    quarter = request.data.get("quarter")
    quarter_grade = request.data.get("quarter_grade")

    if not student_id and not student_number:
        return Response({"detail": "student_id or student_number is required."}, status=400)

    recipient, profile = _resolve_student_recipient(student_id, student_number)
    if not recipient:
        return Response({"detail": "Student profile not found."}, status=404)

    if not student_name and profile:
        student_name = " ".join(
            p for p in [profile.student_first_name or "", profile.student_last_name or ""] if p
        ).strip() or getattr(recipient, "username", "the student")

    message = "A teacher has given you a star for good performance. Keep it up!"
    details = []
    if quarter:
        details.append(f"Quarter {quarter}")
    if quarter_grade is not None:
        details.append(f"grade {quarter_grade}")

    if details:
        message = f"{message} ({', '.join(details)})"

    reminder = Reminder.objects.create(
        recipient=recipient,
        sender=request.user,
        title="Star Award Received",
        message=message,
        reminder_type="PERFORMANCE",
        is_read=False,
        event_type="STAR_AWARD",
    )

    return Response(
        {
            "detail": f"Star sent to {student_name or 'student'}.",
            "reminder": ReminderSerializer(reminder).data,
        },
        status=201,
    )