from django.contrib import admin
from .models import Transaction, TuitionConfig, ProofOfPayment


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


@admin.register(ProofOfPayment)
class ProofOfPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'parent',
        'reference_number',
        'payment_amount',
        'payment_date',
        'status',
        'submitted_date',
        'reviewed_date',
    )
    search_fields = (
        'parent__username',
        'reference_number',
        'transaction__reference_number',
    )
    list_filter = (
        'status',
        'payment_method',
        'submitted_date',
        'reviewed_date',
    )
    readonly_fields = (
        'submitted_date',
        'reviewed_date',
        'reviewed_by',
    )
    
    def get_readonly_fields(self, request, obj=None):
        # Additional fields that shouldn't be edited after creation
        if obj:
            return self.readonly_fields + ('parent', 'transaction', 'document')
        return self.readonly_fields
    
    fieldsets = (
        ('Submission Info', {
            'fields': ('parent', 'transaction', 'reference_number', 'submitted_date')
        }),
        ('Payment Details', {
            'fields': ('payment_amount', 'payment_date', 'payment_method', 'description')
        }),
        ('Document', {
            'fields': ('document',)
        }),
        ('Review Status', {
            'fields': ('status', 'rejection_reason', 'reviewed_by', 'reviewed_date')
        }),
    )