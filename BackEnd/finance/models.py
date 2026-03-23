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