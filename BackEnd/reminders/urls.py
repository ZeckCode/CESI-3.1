from django.urls import path

from .views import (
    ReminderListCreateView,
    ReminderDetailView,
    mark_reminder_as_read,
    send_payment_reminder,
    send_bulk_payment_reminders,
    payment_ledger_nearest_due,
    send_performance_reminder,
    send_star_notification,
    send_paid_notification,
    send_onsite_payment_notification,
)

urlpatterns = [
    path("", ReminderListCreateView.as_view(), name="reminder-list-create"),
    path("<int:pk>/", ReminderDetailView.as_view(), name="reminder-detail"),
    path('mark-read/<int:pk>/', mark_reminder_as_read),

    # payment reminder actions
    path("payments/ledger/nearest-due/", payment_ledger_nearest_due, name="payment-ledger-nearest-due"),
    path("payments/<int:transaction_id>/send/", send_payment_reminder, name="send-payment-reminder"),
    path("payments/send-bulk/", send_bulk_payment_reminders, name="send-bulk-payment-reminders"),
    path("payments/<int:transaction_id>/paid/", send_paid_notification, name="send-paid-notification"),
    path("payments/<int:transaction_id>/onsite-paid/", send_onsite_payment_notification, name="send-onsite-payment-notification"),
    path("performance/send/", send_performance_reminder, name="send-performance-reminder"),
    path("performance/star/send/", send_star_notification, name="send-star-notification"),
]