from django.contrib import admin
from .models import Transaction, TuitionConfig


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'student_name',
        'parent',
        'transaction_type',
        'amount',
        'status',
        'date_created',
    )
    search_fields = (
        'student_name',
        'parent__username',
        'reference_number',
    )
    list_filter = (
        'transaction_type',
        'status',
        'payment_method',
    )


@admin.register(TuitionConfig)
class TuitionConfigAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'grade_key',
        'grade_label',
        'cash',
        'installment',
        'initial',
        'monthly',
        'total_cash',
        'total_installment',
        'status',
        'is_active',
        'updated_date',
    )
    search_fields = (
        'grade_key',
        'grade_label',
        'description',
    )
    list_filter = (
        'status',
        'is_active',
    )