from django.urls import path
from .views import (
    TransactionListCreate,
    TransactionDetail,
    transaction_stats,
    parent_list,
    parent_students,
    my_transactions,
    my_ledger_summary,
)

urlpatterns = [
    # Admin endpoints
    path('transactions/', TransactionListCreate.as_view(), name='transaction-list'),
    path('transactions/<int:pk>/', TransactionDetail.as_view(), name='transaction-detail'),
    path('transactions/stats/', transaction_stats, name='transaction-stats'),
    path('parents/', parent_list, name='parent-list'),
    path('parents/<int:parent_id>/students/', parent_students, name='parent-students'),

    # Parent endpoint — own ledger
    path('my-transactions/', my_transactions, name='my-transactions'),
    path('my-ledger-summary/', my_ledger_summary, name='my-ledger-summary'),
]
