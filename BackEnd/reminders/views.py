@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_paid_notification(request, transaction_id):
    if not is_admin(request.user):
        return Response(
            {"detail": "Only admin can send paid notifications."},
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
    transaction_type = getattr(transaction, "transaction_type", "Payment")
    reference_number = getattr(transaction, "reference_number", "N/A")
    student_name = getattr(transaction, "student_name", "your child")

    title = f"Payment Received - {transaction_type}"
    message = (
        f"Good news! We have received your payment for {student_name}.\n"
        f"Reference No: {reference_number}.\n"
        f"Amount paid: ₱{amount}.\n"
        f"Thank you for settling your bill."
    ).strip()

    reminder = Reminder.objects.create(
        recipient=recipient,
        sender=request.user,
        title=title,
        message=message,
        reminder_type="PAID",
        transaction=transaction,
        is_read=False,
    )
    print("[PAID NOTIFICATION SENT]")
    print("Reminder created:")
    print("Recipient:", recipient.username)
    print("Transaction ID:", transaction.id)
    print("Title:", title)
    print("Message:", message)

    return Response(
        {
            "detail": "Payment notification sent successfully.",
            "reminder": ReminderSerializer(reminder).data,
        },
        status=status.HTTP_201_CREATED,
    )
#Reminders views.py
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .models import Reminder
from .serializers import ReminderSerializer
from finance.models import Transaction

User = get_user_model()


def is_admin(user):
    return user.is_authenticated and (
        getattr(user, "is_staff", False)
        or getattr(user, "role", "").upper() == "ADMIN"
    )


class ReminderListCreateView(generics.ListCreateAPIView):
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Reminder.objects.select_related(
            "recipient", "sender", "transaction"
        ).all()

        reminder_type = self.request.query_params.get("type")
        recipient_id = self.request.query_params.get("recipient")
        is_read = self.request.query_params.get("is_read")

        if reminder_type:
            reminder_type = reminder_type.upper()
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
            "recipient", "sender", "transaction"
        ).all()

        if is_admin(self.request.user):
            return queryset

        return queryset.filter(recipient=self.request.user)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_reminder_as_read(request, pk):
    try:
        reminder = Reminder.objects.get(pk=pk)
    except Reminder.DoesNotExist:
        return Response(
            {"detail": "Reminder not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    if not is_admin(request.user) and reminder.recipient != request.user:
        return Response(
            {"detail": "Not allowed."},
            status=status.HTTP_403_FORBIDDEN
        )

    reminder.is_read = True
    reminder.save(update_fields=["is_read"])

    return Response(
        {"detail": "Reminder marked as read."},
        status=status.HTTP_200_OK
    )


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

    title = f"Payment Reminder - {transaction_type}"
    due_text = f" Due date: {due_date}." if due_date else ""
    amount_text = f"Amount due: ₱{amount}." if amount is not None else ""

    message = (
    f"Good day. This is a payment reminder for {getattr(transaction, 'student_name', 'your child')} \n"
    f"regarding {transaction_type}.  "
    f"Reference No: {getattr(transaction, 'reference_number', 'N/A')}.\n "
    f"Amount due: ₱{amount}. \n "
    f"Status: {status_value}. \n "
    f"{f'Due date: {due_date}. ' if due_date else ''} \n"
    f"Please settle this payment as soon as possible."
    ).strip()

    reminder = Reminder.objects.create(
        recipient=recipient,
        sender=request.user,
        title=title,
        message=message,
        reminder_type="PAYMENT",
        transaction=transaction,
        is_read=False,
    )
    print("[REMINDER SENT]")
    print("Reminder created:")
    print("Recipient:", recipient.username)
    print("Transaction ID:", transaction.id)
    print("Title:", title)
    print("Message:", message)
    
    #print(f"[REMINDER SENT] \n\n recipient={recipient.username} \n transaction={transaction.id} \n title={title} \n message={message}")
    return Response(
        {
            "detail": "Payment reminder sent successfully.",
            "reminder": ReminderSerializer(reminder).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_bulk_payment_reminders(request):
    if not is_admin(request.user):
        return Response(
            {"detail": "Only admin can send bulk payment reminders."},
            status=status.HTTP_403_FORBIDDEN
        )

    transactions = Transaction.objects.select_related("parent").filter(
        status__in=["PENDING", "OVERDUE"]
    )

    created = []

    for transaction in transactions:
        recipient = transaction.parent
        amount = getattr(transaction, "amount", None)
        due_date = getattr(transaction, "due_date", None)
        transaction_type = getattr(transaction, "transaction_type", "Payment")

        due_text = f" Due date: {due_date}." if due_date else ""
        amount_text = f"Amount due: ₱{amount}." if amount is not None else ""

        reminder = Reminder.objects.create(
            recipient=recipient,
            sender=request.user,
            title=f"Payment Reminder - {transaction_type}",
            message=(
                f"Good day. This is a reminder regarding your child's {transaction_type}. "
                f"{amount_text}{due_text} Please settle this payment as soon as possible."
            ).strip(),
            reminder_type="PAYMENT",
            transaction=transaction,
            is_read=False,
        )
        created.append(reminder.id)

    return Response(
        {"detail": f"{len(created)} payment reminders sent successfully."},
        status=status.HTTP_201_CREATED,
    )
    
    
    
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_performance_reminder(request):
    if getattr(request.user, "role", "").upper() != "TEACHER":
        return Response({"detail": "Only teachers can send performance reminders."}, status=403)

    student_id = request.data.get("student_id")
    student_name = request.data.get("student_name")
    issue = request.data.get("issue")
    quarter = request.data.get("quarter")
    quarter_grade = request.data.get("quarter_grade")
    attendance_pct = request.data.get("attendance_pct")

    if not student_id:
        return Response({"detail": "student_id is required."}, status=400)

    from accounts.models import UserProfile

    try:
        profile = UserProfile.objects.select_related("user").get(user_id=student_id)
    except UserProfile.DoesNotExist:
        return Response({"detail": "Student profile not found."}, status=404)

    recipient = profile.user

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