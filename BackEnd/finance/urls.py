#finance/urls.py
from django.urls import path
from .views import (
    TransactionListCreate,
    TransactionDetail,
    transaction_stats,
    parent_list,
    parent_students,
    my_transactions,
    my_ledger_summary,
    my_tuition_installments,
    student_tuition_overview,
    TuitionConfigListCreate,
    TuitionConfigDetail,
    tuition_config_stats,
    tuition_config_by_grade,
    ProofOfPaymentViewSet,
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
    path('my-tuition-installments/', my_tuition_installments, name='my-tuition-installments'),

    # ADD THESE NEW TUITION CONFIG ENDPOINTS
    path('tuition-configs/', TuitionConfigListCreate.as_view(), name='tuition-config-list'),
    path('tuition-configs/<int:pk>/', TuitionConfigDetail.as_view(), name='tuition-config-detail'),
    path('tuition-configs/stats/', tuition_config_stats, name='tuition-config-stats'),
    path('student-tuition-overview/', student_tuition_overview, name='student-tuition-overview'),
    
    path('tuition-configs/by-grade/<str:grade_key>/', tuition_config_by_grade, name='tuition-config-by-grade'),

    # PROOF OF PAYMENT ENDPOINTS
    path('proof-of-payments/', ProofOfPaymentViewSet.as_view({'get': 'list', 'post': 'create'}), name='proof-list-create'),
    path('proof-of-payments/<int:pk>/', ProofOfPaymentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='proof-detail'),
    path('proof-of-payments/<int:pk>/approve/', ProofOfPaymentViewSet.as_view({'patch': 'approve'}), name='proof-approve'),
    path('proof-of-payments/<int:pk>/reject/', ProofOfPaymentViewSet.as_view({'patch': 'reject'}), name='proof-reject'),
]