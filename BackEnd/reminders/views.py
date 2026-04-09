
#Reminders views.py
import logging

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
User = get_user_model()


def is_admin(user):
    return user.is_authenticated and (
        getattr(user, "is_staff", False)
        or getattr(user, "role", "").upper() == "ADMIN"
    )

def get_enrollment_balance(enrollment):
    totals = Transaction.objects.filter(enrollment=enrollment).aggregate(
        total_debit=Sum("debit"),
        total_credit=Sum("credit"),
    )
    total_debit = Decimal(str(totals.get("total_debit") or 0))
    total_credit = Decimal(str(totals.get("total_credit") or 0))
    balance = total_debit - total_credit
    return balance if balance > 0 else Decimal("0.00")


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


def _build_payment_reminder_email_message(*, transaction, amount, status_value, due_date, body):
    balance_due = Decimal(str(transaction.debit or transaction.amount or 0)) - Decimal(str(transaction.credit or 0))
    balance_due = balance_due if balance_due > 0 else Decimal("0.00")

    lines = [
        body,
        "",
        "Account Summary:",
        f"Student: {getattr(transaction, 'student_name', 'your child')}",
        f"Reference No: {getattr(transaction, 'reference_number', 'N/A')}",
        f"Amount Due: ₱{amount}",
        f"Balance Remaining: ₱{balance_due}",
        f"Status: {status_value}",
    ]

    if due_date:
        lines.append(f"Due Date: {due_date}")

    lines.extend([
        "",
        "You can review this in the Student Portal as well.",
        "Please settle this payment as soon as possible.",
    ])

    return "\n".join(lines).strip()


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


class ReminderListCreateView(generics.ListCreateAPIView):
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Reminder.objects.select_related(
            "recipient", "sender", "transaction", "proof_of_payment"
        ).all()

        reminder_type = self.request.query_params.get("type")
        recipient_id = self.request.query_params.get("recipient")
        is_read = self.request.query_params.get("is_read")

        if reminder_type:
            reminder_type = reminder_type.upper()
            if reminder_type == "PAYMENT" and not is_admin(self.request.user):
                # Backward-compatible bell/API behavior: PAYMENT feed also includes
                # star-award notifications sent by teachers.
                star_filter = Q(reminder_type="PERFORMANCE") & (
                    Q(title__icontains="star") | Q(message__icontains="given you a star")
                )
                queryset = queryset.filter(Q(reminder_type="PAYMENT") | star_filter)
            else:
                queryset = queryset.filter(reminder_type=reminder_type)

        if recipient_id:
            queryset = queryset.filter(recipient_id=recipient_id)

        if is_read is not None:
            if is_read.lower() == "true":
                queryset = queryset.filter(is_read=True)
            elif is_read.lower() == "false":
                queryset = queryset.filter(is_read=False)

        if is_admin(self.request.user):
            return queryset

        role = getattr(self.request.user, "role", "").upper()

        # Teacher should see PERFORMANCE reminders they SENT
        if role == "TEACHER" and reminder_type == "PERFORMANCE":
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
            return queryset

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

    recipient = transaction.parent
    amount = getattr(transaction, "amount", None)
    status_value = getattr(transaction, "status", "PENDING")
    due_date = getattr(transaction, "due_date", None)
    transaction_type = getattr(transaction, "transaction_type", "Payment")
    status_upper = str(status_value).upper()

    if status_upper not in {"PENDING", "OVERDUE"}:
        return Response(
            {"detail": "Only pending and overdue payments can receive reminders."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if due_date and due_date > timezone.localdate():
        return Response(
            {"detail": "This payment is not due yet."},
            status=status.HTTP_400_BAD_REQUEST
        )

    event_type = "PAYMENT_OVERDUE" if status_upper == "OVERDUE" else "PAYMENT_DUE"
    title = f"Payment Reminder - {transaction_type}"
    message = _build_payment_reminder_email_message(
        transaction=transaction,
        amount=amount,
        status_value=status_value,
        due_date=due_date,
        body=f"Good day. This is a payment reminder for {getattr(transaction, 'student_name', 'your child')}."
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
    try:
        reminder = Reminder.objects.get(pk=pk, recipient=request.user)
    except Reminder.DoesNotExist:
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
    transactions = Transaction.objects.select_related("parent").filter(
        entry_type="DEBIT",
        status__in=["PENDING", "OVERDUE"],
        due_date__isnull=False,
        due_date__lte=today,
    )

    created_count = 0
    duplicate_count = 0
    emailed_count = 0
    missing_email_count = 0
    email_failed_count = 0

    for transaction in transactions:
        recipient = transaction.parent
        amount = getattr(transaction, "amount", None)
        due_date = getattr(transaction, "due_date", None)
        transaction_type = getattr(transaction, "transaction_type", "Payment")
        status_value = str(transaction.status).upper()
        event_type = "PAYMENT_OVERDUE" if status_value == "OVERDUE" else "PAYMENT_DUE"
        title = (
            f"Formal {'Overdue' if status_value == 'OVERDUE' else 'Payment'} Notice - "
            f"{getattr(transaction, 'student_name', 'Student')}"
        )
        email_message = _build_payment_reminder_email_message(
            transaction=transaction,
            amount=amount,
            status_value=transaction.status,
            due_date=due_date,
            body=(
                f"Dear Parent/Guardian,\n\n"
                f"This is an official reminder regarding your child's {transaction_type} account balance."
            ),
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

    return Response(
        {
            "detail": (
                f"{created_count} reminder record(s) saved, "
                f"{emailed_count} email(s) sent, "
                f"{missing_email_count} skipped for missing email, "
                f"{email_failed_count} email(s) failed, "
                f"{duplicate_count} skipped as duplicates."
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