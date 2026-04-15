from rest_framework import serializers
from CESI.serializer_safety import SafeSerializer, SafeModelSerializer
from .models import Reminder
from decimal import Decimal


class ReminderSerializer(SafeModelSerializer):
    recipient_name = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()
    amount_to_pay = serializers.SerializerMethodField()
    reference_number = serializers.SerializerMethodField()
    transaction_status = serializers.SerializerMethodField()
    transaction_due_date = serializers.SerializerMethodField()
    outstanding_balance = serializers.SerializerMethodField()
    can_send_payment_reminder = serializers.SerializerMethodField()

    class Meta:
        model = Reminder
        fields = [
            "id",
            "recipient",
            "recipient_name",
            "sender",
            "sender_name",
            "title",
            "message",
            "reminder_type",
            "event_type",
            "transaction",
            "proof_of_payment",
            "reference_number",
            "amount_to_pay",
            "transaction_status",
            "transaction_due_date",
            "outstanding_balance",
            "can_send_payment_reminder",
            "reference_date",
            "is_read",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_recipient_name(self, obj):
        recipient = obj.recipient
        return recipient.email or str(recipient)

    def get_sender_name(self, obj):
        sender = obj.sender
        if not sender:
            return "System"
        return sender.email or str(sender)

    def get_amount_to_pay(self, obj):
        if obj.transaction and obj.transaction.amount is not None:
            return obj.transaction.amount
        return None

    def get_reference_number(self, obj):
        if obj.transaction and getattr(obj.transaction, "reference_number", None):
            return obj.transaction.reference_number
        return None

    def _get_outstanding_balance(self, obj):
        if not obj.transaction:
            return Decimal("0.00")

        debit_amount = Decimal(str(getattr(obj.transaction, "debit", 0) or getattr(obj.transaction, "amount", 0) or 0))
        credit_amount = Decimal(str(getattr(obj.transaction, "credit", 0) or 0))
        outstanding = debit_amount - credit_amount
        return outstanding if outstanding > 0 else Decimal("0.00")

    def get_transaction_status(self, obj):
        if obj.transaction:
            return getattr(obj.transaction, "status", None)
        return None

    def get_transaction_due_date(self, obj):
        if obj.transaction:
            return getattr(obj.transaction, "due_date", None)
        return None

    def get_outstanding_balance(self, obj):
        return self._get_outstanding_balance(obj)

    def get_can_send_payment_reminder(self, obj):
        """
        Check if a reminder can be sent for this transaction.
        Must have:
        1. A linked transaction
        2. Entry type must be DEBIT
        3. Status must be PENDING or OVERDUE (not PARTIAL)
        4. Outstanding balance > 0
        5. Due date <= today
        """
        if not obj.transaction:
            return False

        tx = obj.transaction
        
        # Must be a DEBIT entry
        if getattr(tx, "entry_type", "") != "DEBIT":
            return False
        
        # Status must be PENDING or OVERDUE (NOT PARTIAL)
        status = str(getattr(tx, "status", "") or "").upper()
        if status not in ["PENDING", "OVERDUE"]:
            return False
        
        # Must have outstanding balance
        outstanding = self._get_outstanding_balance(obj)
        if outstanding <= 0:
            return False
        
        # Due date must be today or earlier
        due_date = getattr(tx, "due_date", None)
        if not due_date:
            return False
        
        from datetime import date
        try:
            due_date_obj = due_date if isinstance(due_date, date) else date.fromisoformat(str(due_date))
            today = date.today()
            if due_date_obj > today:
                return False
        except (ValueError, TypeError):
            return False
        
        return True