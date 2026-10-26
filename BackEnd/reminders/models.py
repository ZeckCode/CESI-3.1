from django.db import models
from django.conf import settings


class Reminder(models.Model):
    REMINDER_TYPE_CHOICES = [
        ("PAYMENT", "Payment"),
        ("PERFORMANCE", "Performance"),
        ("GENERAL", "General"),
    ]

    EVENT_TYPE_CHOICES = [
        ("PAYMENT_RECEIVED", "Payment Received"),
        ("PAYMENT_DUE", "Payment Due"),
        ("PAYMENT_OVERDUE", "Payment Overdue"),
        ("PROOF_APPROVED", "Proof Approved"),
        ("PROOF_REJECTED", "Proof Rejected"),
        ("PERFORMANCE_ALERT", "Performance Alert"),
        ("STAR_AWARD", "Star Award"),
        ("GENERAL_NOTICE", "General Notice"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_reminders"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_reminders"
    )

    title = models.CharField(max_length=255)
    message = models.TextField()

    reminder_type = models.CharField(
        max_length=20,
        choices=REMINDER_TYPE_CHOICES
    )

    event_type = models.CharField(
        max_length=40,
        choices=EVENT_TYPE_CHOICES,
        default="GENERAL_NOTICE"
    )

    transaction = models.ForeignKey(
        "finance.Transaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reminders"
    )

    proof_of_payment = models.ForeignKey(
        "finance.ProofOfPayment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reminders"
    )

    reference_date = models.DateField(null=True, blank=True)

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    
    event_type = models.CharField(max_length=50, null=True, blank=True)
    reference_date = models.DateField(null=True, blank=True)
    proof_of_payment = models.ForeignKey(
        "finance.ProofOfPayment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reminders"
    )
    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "transaction", "event_type", "reference_date"],
                name="uniq_reminder_recipient_transaction_event_refdate",
            )
        ]

    def __str__(self):
        return f"{self.reminder_type} - {self.title} -> {self.recipient}"