from rest_framework import serializers
from .models import Reminder


class ReminderSerializer(serializers.ModelSerializer):
    recipient_name = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()
    amount_to_pay = serializers.SerializerMethodField()
    reference_number = serializers.SerializerMethodField()

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
            "transaction",
            "reference_number",
            "amount_to_pay",
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