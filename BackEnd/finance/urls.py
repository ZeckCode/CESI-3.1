from django.urls import path
from .views import (
    TransactionListCreate,
    TransactionDetail,
    transaction_stats,
    parent_list,
    parent_students,
    my_transactions,
    my_ledger_summary,

    TuitionConfigListCreate,
    TuitionConfigDetail,
    tuition_config_stats,
    tuition_config_by_grade,
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

    # ADD THESE NEW TUITION CONFIG ENDPOINTS
    path('tuition-configs/', TuitionConfigListCreate.as_view(), name='tuition-config-list'),
    path('tuition-configs/<int:pk>/', TuitionConfigDetail.as_view(), name='tuition-config-detail'),
    path('tuition-configs/stats/', tuition_config_stats, name='tuition-config-stats'),
    path('tuition-configs/by-grade/<str:grade_key>/', tuition_config_by_grade, name='tuition-config-by-grade'),
]