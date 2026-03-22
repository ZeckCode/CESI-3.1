from django.contrib import admin
from .models import Reminder


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "reminder_type",
        "recipient",
        "sender",
        "transaction",
        "is_read",
        "created_at",
    )
    list_filter = ("reminder_type", "is_read", "created_at")
    search_fields = ("title", "message", "recipient__username", "recipient__first_name", "recipient__last_name")