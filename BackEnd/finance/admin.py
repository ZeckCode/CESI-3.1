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
    list_display = [
        'id', 
        'user', 
        'reference_number', 
        'status', 
        'created_at',
        'updated_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['reference_number', 'description', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Submission Info', {
            'fields': ('user', 'reference_number', 'description', 'proof_image')
        }),
        ('Admin Review', {
            'fields': ('status', 'admin_remarks'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )