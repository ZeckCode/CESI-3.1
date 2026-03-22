# from django.db import models
# from django.conf import settings


# class Reminder(models.Model):
#     REMINDER_TYPE_CHOICES = [
#         ("PAYMENT", "Payment"),
#         ("PERFORMANCE", "Performance"),
#         ("GENERAL", "General"),
#     ]

#     recipient = models.ForeignKey(
#         settings.AUTH_USER_MODEL,
#         on_delete=models.CASCADE,
#         related_name="received_reminders"
#     )
#     sender = models.ForeignKey(
#         settings.AUTH_USER_MODEL,
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name="sent_reminders"
#     )

#     title = models.CharField(max_length=255)
#     message = models.TextField()

#     reminder_type = models.CharField(
#         max_length=20,
#         choices=REMINDER_TYPE_CHOICES
#     )

#     # for payment reminder
#     transaction = models.ForeignKey(
#         "finance.Transaction",
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name="reminders"
#     )

#     # for future grade/performance reminder
#     grade_item = models.ForeignKey(
#         "grading.GradeItem",
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name="reminders"
#     )

#     is_read = models.BooleanField(default=False)
#     created_at = models.DateTimeField(auto_now_add=True)

#     class Meta:
#         ordering = ["-created_at"]

#     def __str__(self):
#         return f"{self.reminder_type} - {self.title} -> {self.recipient}"



from django.db import models
from django.conf import settings


class Reminder(models.Model):
    REMINDER_TYPE_CHOICES = [
        ("PAYMENT", "Payment"),
        ("PERFORMANCE", "Performance"),
        ("GENERAL", "General"),
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

    transaction = models.ForeignKey(
        "finance.Transaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reminders"
    )

    # add this later when your grading app/model is confirmed
    # grade_item = models.ForeignKey(
    #     "grading.GradeItem",
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name="reminders"
    # )

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reminder_type} - {self.title} -> {self.recipient}"