# finance/models.py
from decimal import Decimal
from django.db import models
from accounts.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
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
        ('OTHER', 'Other'),
    ]

    parent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='transactions',
        limit_choices_to={'role': 'PARENT_STUDENT'},
    )

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
    """
    Model for storing proof of payment submissions by parents/students.
    Allows users to upload documentation (photos, screenshots, receipts) 
    to verify payment made for transactions.
    """
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('RESUBMIT', 'Resubmit Required'),
    ]

    parent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='payment_proofs',
        limit_choices_to={'role': 'PARENT_STUDENT'},
        help_text="The parent/student submitting the proof"
    )

    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.CASCADE,
        related_name='proof_of_payment',
        help_text="The transaction this proof is for"
    )

    reference_number = models.CharField(
        max_length=50,
        help_text="Payment reference/transaction number from bank or payment provider"
    )

    payment_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Amount shown in the proof of payment"
    )

    payment_date = models.DateField(
        help_text="Date the payment was made"
    )

    payment_method = models.CharField(
        max_length=50,
        help_text="Method of payment (e.g., Bank Transfer, GCash, Check)"
    )

    document = models.FileField(
        upload_to='payment_proofs/%Y/%m/',
        help_text="Upload image or PDF of payment proof (receipt, bank transfer confirmation, etc.)"
    )

    description = models.TextField(
        blank=True,
        null=True,
        help_text="Additional notes or details about the payment"
    )

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='PENDING',
        help_text="Review status of the submitted proof"
    )

    rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for rejection if status is REJECTED"
    )

    submitted_date = models.DateTimeField(
        auto_now_add=True,
        help_text="When the proof was submitted"
    )

    reviewed_date = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When the proof was reviewed"
    )

    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_payment_proofs',
        limit_choices_to={'role': 'ADMIN'},
        help_text="Admin who reviewed this proof"
    )

    class Meta:
        ordering = ['-submitted_date']
        verbose_name = 'Proof of Payment'
        verbose_name_plural = 'Proofs of Payment'

    def __str__(self):
        return f"Payment Proof - {self.parent.user.username if hasattr(self.parent, 'user') else self.parent} - {self.reference_number}"