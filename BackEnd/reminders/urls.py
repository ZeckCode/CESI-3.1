from django.urls import path

from .views import (
    ReminderListCreateView,
    ReminderDetailView,
    mark_reminder_as_read,
    send_payment_reminder,
    send_bulk_payment_reminders,
    send_performance_reminder,
    send_paid_notification,
)

urlpatterns = [
    path("", ReminderListCreateView.as_view(), name="reminder-list-create"),
    path("<int:pk>/", ReminderDetailView.as_view(), name="reminder-detail"),
    path("<int:pk>/read/", mark_reminder_as_read, name="mark-reminder-read"),

    # payment reminder actions
    path("payments/<int:transaction_id>/send/", send_payment_reminder, name="send-payment-reminder"),
    path("payments/send-bulk/", send_bulk_payment_reminders, name="send-bulk-payment-reminders"),
    path("payments/<int:transaction_id>/paid/", send_paid_notification, name="send-paid-notification"),
    path("performance/send/", send_performance_reminder, name="send-performance-reminder"),
]