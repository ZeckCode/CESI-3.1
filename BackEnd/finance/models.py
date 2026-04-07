# finance/models.py
from decimal import Decimal
from django.db import models
from accounts.models import User
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
# finance/models.py

class Transaction(models.Model):
    TYPE_CHOICES = [
        ('TUITION', 'Tuition Fee'),
        ('MISC', 'Miscellaneous'),
        ('REGISTRATION', 'Registration Fee'),
        ('BOOKS', 'Books & Materials'),
        ('UNIFORM', 'Uniform'),
        ('OTHER', 'Other'),
    ]

    STATUS_CHOICES = [
        ('PAID', 'Paid'),
        ('PARTIAL', 'Partial'),
        ('PENDING', 'Pending'),
        ('OVERDUE', 'Overdue'),
        ('POSTED', 'Posted'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('GCASH', 'GCash'),
        ('PAYMAYA', 'PayMaya'),
        ('CHECK', 'Check'),
        ('OTHER', 'Other'),
    ]

    ENTRY_TYPE_CHOICES = [
        ('DEBIT', 'Debit'),
        ('CREDIT', 'Credit'),
    ]

    ITEM_CHOICES = [
        ('REGISTRATION', 'Registration'),
        ('PAYMENT', 'Payment'),
        ('INITIAL', 'Initial Payment'),
        ('MONTHLY', 'Monthly Installment'),
        ('MISC', 'Miscellaneous'),
        ('RESERVATION', 'Reservation Fee'),
        ('ASSESSMENT', 'Assessment'),
        ('REFUND', 'Refund'),
        ('ADVANCE', 'Advance Credit'),
         ('ADVANCE_TRANSFER_OUT', 'Advance Transfer Out'),
        ('ADVANCE_APPLIED', 'Advance Applied'),
        ('OTHER', 'Other'),
    ]

    parent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='transactions',
        limit_choices_to={'role': 'PARENT_STUDENT'},
    )

    enrollment = models.ForeignKey(
        'enrollment.Enrollment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='finance_transactions',
    )

    student_number_snapshot = models.CharField(max_length=20, blank=True, null=True)
    grade_level_snapshot = models.CharField(max_length=20, blank=True, null=True)
    payment_mode_snapshot = models.CharField(max_length=20, blank=True, null=True)
    student_type_snapshot = models.CharField(max_length=20, blank=True, null=True)

    student_name = models.CharField(max_length=150)

    transaction_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default='TUITION'
    )

    entry_type = models.CharField(
        max_length=10,
        choices=ENTRY_TYPE_CHOICES,
        default='DEBIT'
    )

    item = models.CharField(
        max_length=20,
        choices=ITEM_CHOICES,
        default='PAYMENT'
    )

    school_year = models.CharField(max_length=20, blank=True, null=True)
    semester = models.CharField(max_length=10, blank=True, null=True)

    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    debit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    description = models.TextField(blank=True, null=True)
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        default='CASH'
    )
    reference_number = models.CharField(max_length=50, blank=True, null=True)

    transaction_date = models.DateField(blank=True, null=True)
    date_posted = models.DateField(default=timezone.localdate)
    due_date = models.DateField(blank=True, null=True)

    date_created = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='POSTED')

    class Meta:
        ordering = ['date_created', 'id']

    def save(self, *args, **kwargs):
        amt = Decimal(str(self.amount or 0))

        if self.entry_type == 'DEBIT':
            self.debit = amt
            self.credit = Decimal('0.00')
        else:
            self.credit = amt
            self.debit = Decimal('0.00')

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student_name} - {self.item} - {self.entry_type} ({self.id})"

class TuitionConfig(models.Model):
    GRADE_KEY_CHOICES = [
        ('prek', 'Pre-Kinder'),
        ('kinder', 'Kinder'),
        ('grade1', 'Grade 1'),
        ('grade2', 'Grade 2'),
        ('grade3', 'Grade 3'),
        ('grade4', 'Grade 4'),
        ('grade5', 'Grade 5'),
        ('grade6', 'Grade 6'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]

    grade_key = models.CharField(max_length=20, choices=GRADE_KEY_CHOICES, unique=True)
    grade_label = models.CharField(max_length=100)

    cash = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    installment = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    initial = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    reservation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=2000)
    misc_aug = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    misc_nov = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    assessment = models.DecimalField(max_digits=10, decimal_places=2, default=300)

    total_cash = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_installment = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    is_active = models.BooleanField(default=True)

    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['grade_key']
        verbose_name = 'Tuition Configuration'
        verbose_name_plural = 'Tuition Configurations'

    def clean(self):
        installment_base = (self.initial or Decimal('0')) + ((self.monthly or Decimal('0')) * Decimal('10'))
        if (self.installment or Decimal('0')) != installment_base:
            raise ValidationError({
                'installment': f'Installment must equal initial + (monthly × 10). Expected {installment_base}.'
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        self.total_cash = (self.cash or Decimal('0')) + (self.misc_aug or Decimal('0')) + (self.misc_nov or Decimal('0'))
        self.total_installment = (self.installment or Decimal('0')) + (self.misc_aug or Decimal('0')) + (self.misc_nov or Decimal('0'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.grade_label} Tuition"



class ProofOfPayment(models.Model):
    PAYMENT_TYPE_CHOICES = [
        ('enrollment', 'Enrollment Initial Payment'),
        ('installment', 'Installment Payment'),
    ]

    SOURCE_CHOICES = [
        ('enrollment_form', 'Enrollment Form'),
        ('student_portal', 'Student Portal'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    BILLED_ITEM_CHOICES = [
        ('PAYMENT', 'General Payment'),
        ('INITIAL', 'Initial Payment'),
        ('MONTHLY', 'Monthly Installment'),
        ('MISC', 'Miscellaneous'),
        ('REGISTRATION', 'Registration'),
        ('ASSESSMENT', 'Assessment'),
        ('OTHER', 'Other'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='proof_of_payments'
    )

    payment_type = models.CharField(
        max_length=20,
        choices=PAYMENT_TYPE_CHOICES,
        default='installment'
    )
    source = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        blank=True,
        null=True
    )

    enrollment = models.ForeignKey(
        'enrollment.Enrollment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_proof'
    )

    reference_number = models.CharField(max_length=100)
    description = models.TextField()

    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    billed_item = models.CharField(
        max_length=20,
        choices=BILLED_ITEM_CHOICES,
        default='PAYMENT'
    )
    billed_due_date = models.DateField(null=True, blank=True)

    proof_image = models.ImageField(upload_to='proofs/%Y/%m/%d/')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    admin_remarks = models.TextField(blank=True, null=True)

    approved_transaction = models.ForeignKey(
        'finance.Transaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_payment_proofs'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.reference_number}"
class AdvanceRequest(models.Model):
    REQUEST_TYPE_CHOICES = [
        ('APPLY_ADVANCE', 'Apply Advance'),
        ('REFUND', 'Refund'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('PROCESSED', 'Processed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='advance_requests'
    )

    enrollment = models.ForeignKey(
        'enrollment.Enrollment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='advance_requests'
    )

    request_type = models.CharField(max_length=20, choices=REQUEST_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    admin_remarks = models.TextField(blank=True, null=True)
    processed_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.request_type} - {self.status}"