from decimal import Decimal
from django.db.models import Sum
from rest_framework import serializers

from .models import Transaction, TuitionConfig, ProofOfPayment
from accounts.models import User, UserProfile


class TransactionSerializer(serializers.ModelSerializer):
    parent_username = serializers.CharField(source='parent.username', read_only=True)
    date_created = serializers.DateTimeField(format="%Y-%m-%d %H:%M", read_only=True)
    transaction_date = serializers.DateField(format="%Y-%m-%d", required=False, allow_null=True)
    date_posted = serializers.DateField(format="%Y-%m-%d", read_only=True)
    due_date = serializers.DateField(format="%Y-%m-%d", required=False, allow_null=True)

    student_name = serializers.CharField(read_only=True)
    student_number = serializers.CharField(source='parent.profile.student_number', read_only=True, default='')
    payment_mode = serializers.CharField(source='parent.profile.payment_mode', read_only=True, default='')
    grade_level = serializers.CharField(source='parent.profile.grade_level', read_only=True, default='')

    class Meta:
        model = Transaction
        fields = [
            'id',
            'parent',
            'parent_username',
            'student_name',
            'student_number',
            'grade_level',
            'payment_mode',

            'transaction_type',
            'entry_type',
            'item',
            'school_year',
            'semester',

            'amount',
            'debit',
            'credit',
            'balance',

            'description',
            'payment_method',
            'reference_number',
            'transaction_date',
            'date_posted',
            'due_date',
            'date_created',
            'status',
        ]
        read_only_fields = ['debit', 'credit', 'balance', 'date_posted', 'date_created']


class TransactionCreateSerializer(serializers.ModelSerializer):
    due_date = serializers.DateField(required=False, allow_null=True)
    transaction_date = serializers.DateField(required=False, allow_null=True)
    student_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Transaction
        fields = [
            'parent',
            'student_name',
            'transaction_type',
            'entry_type',
            'item',
            'school_year',
            'semester',
            'amount',
            'description',
            'payment_method',
            'transaction_date',
            'due_date',
            'status',
        ]

    def validate_parent(self, value):
        if value.role != 'PARENT_STUDENT':
            raise serializers.ValidationError("Selected user is not a Parent/Student account.")
        return value

    def validate_status(self, value):
        allowed = {'PAID', 'PARTIAL', 'PENDING', 'OVERDUE', 'POSTED'}
        if value not in allowed:
            raise serializers.ValidationError(
                "Invalid status. Allowed values: PAID, PARTIAL, PENDING, OVERDUE, POSTED."
            )
        return value

    def _auto_fill_student_name(self, validated_data):
        parent = validated_data.get('parent') or getattr(self.instance, 'parent', None)
        if validated_data.get('student_name'):
            return

        if not parent:
            return

        try:
            profile = parent.profile
            validated_data['student_name'] = (
                f"{profile.student_first_name} {profile.student_last_name}"
            ).strip()
        except UserProfile.DoesNotExist:
            validated_data['student_name'] = parent.username

    def _compute_next_balance(self, parent):
        totals = Transaction.objects.filter(parent=parent).aggregate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
        )
        total_debit = Decimal(str(totals.get('total_debit') or 0))
        total_credit = Decimal(str(totals.get('total_credit') or 0))
        return total_debit - total_credit

    def validate(self, attrs):
        parent = attrs.get('parent') or getattr(self.instance, 'parent', None)
        transaction_type = attrs.get('transaction_type') or getattr(self.instance, 'transaction_type', None)
        entry_type = attrs.get('entry_type') or getattr(self.instance, 'entry_type', None)
        item = attrs.get('item') or getattr(self.instance, 'item', None)
        amount = attrs.get('amount', getattr(self.instance, 'amount', None))
        due_date = attrs.get('due_date', getattr(self.instance, 'due_date', None))

        if amount is not None:
            amount = Decimal(str(amount))
            if amount <= 0:
                raise serializers.ValidationError({'amount': 'Amount must be greater than 0.'})

        if entry_type == 'DEBIT' and item == 'PAYMENT':
            raise serializers.ValidationError({'item': 'PAYMENT item must use CREDIT entry type.'})

        if entry_type == 'CREDIT' and item in {'REGISTRATION', 'MONTHLY', 'MISC', 'RESERVATION', 'ASSESSMENT'}:
            raise serializers.ValidationError({'item': f'{item} is normally a DEBIT billing entry.'})

        if not parent or transaction_type != 'TUITION':
            return attrs

        try:
            profile = parent.profile
        except UserProfile.DoesNotExist:
            raise serializers.ValidationError("Parent/student profile not found.")

        payment_mode = (profile.payment_mode or '').strip().lower()
        grade_key = (profile.grade_level or '').strip().lower()

        tuition = TuitionConfig.objects.filter(
            grade_key=grade_key,
            is_active=True,
            status='active'
        ).first()

        if not tuition:
            raise serializers.ValidationError(
                "No active tuition configuration found for this student's grade level."
            )

        amount = Decimal(str(amount or '0'))

        if payment_mode == 'cash':
            expected = Decimal(str(tuition.total_cash or 0))

            if entry_type == 'CREDIT' and item == 'PAYMENT':
                if amount != expected:
                    raise serializers.ValidationError({
                        'amount': f'Cash payment must equal the full total cash amount: {expected}.'
                    })

                if due_date:
                    raise serializers.ValidationError({
                        'due_date': 'Due date is not allowed for cash payment entries.'
                    })

            if entry_type == 'DEBIT' and item == 'REGISTRATION':
                if amount != expected:
                    raise serializers.ValidationError({
                        'amount': f'Cash billing entry must equal the full total cash amount: {expected}.'
                    })

        elif payment_mode == 'installment':
            initial = Decimal(str(tuition.initial or 0))
            monthly = Decimal(str(tuition.monthly or 0))
            misc_aug = Decimal(str(tuition.misc_aug or 0))
            misc_nov = Decimal(str(tuition.misc_nov or 0))
            total_installment = Decimal(str(tuition.total_installment or 0))

            if entry_type == 'CREDIT':
                valid_credit_amounts = {a for a in [initial, monthly, misc_aug, misc_nov] if a > 0}
                if item in {'PAYMENT', 'INITIAL'} and amount not in valid_credit_amounts:
                    raise serializers.ValidationError({
                        'amount': (
                            f'Installment credit/payment must match one of: '
                            f'initial ({initial}), monthly ({monthly}), misc_aug ({misc_aug}), misc_nov ({misc_nov}).'
                        )
                    })

            if entry_type == 'DEBIT':
                if item == 'REGISTRATION' and amount != total_installment:
                    raise serializers.ValidationError({
                        'amount': f'Registration debit must equal total installment: {total_installment}.'
                    })
                if item == 'MONTHLY' and amount != monthly:
                    raise serializers.ValidationError({
                        'amount': f'Monthly debit must equal monthly amount: {monthly}.'
                    })
                if item == 'MISC' and amount not in {misc_aug, misc_nov}:
                    raise serializers.ValidationError({
                        'amount': f'MISC debit must equal misc_aug ({misc_aug}) or misc_nov ({misc_nov}).'
                    })

        else:
            raise serializers.ValidationError({
                'parent': 'Student payment mode must be either cash or installment.'
            })

        return attrs

    def create(self, validated_data):
        self._auto_fill_student_name(validated_data)

        if not validated_data.get('reference_number'):
            from django.utils import timezone
            year = timezone.now().year
            last = Transaction.objects.order_by('-id').first()
            seq = (last.id + 1) if last else 1
            validated_data['reference_number'] = f"CESI-{year}-{seq:05d}"

        if not validated_data.get('transaction_date'):
            from django.utils import timezone
            validated_data['transaction_date'] = timezone.localdate()

        tx = super().create(validated_data)

        tx.balance = self._compute_next_balance(tx.parent)
        tx.save(update_fields=['balance'])

        return tx

    def update(self, instance, validated_data):
        self._auto_fill_student_name(validated_data)
        tx = super().update(instance, validated_data)

        totals = Transaction.objects.filter(parent=tx.parent).order_by(
            'transaction_date', 'date_posted', 'id'
        )

        running = Decimal('0.00')
        for row in totals:
            running += Decimal(str(row.debit or 0)) - Decimal(str(row.credit or 0))
            if row.balance != running:
                row.balance = running
                row.save(update_fields=['balance'])

        return tx


class ParentDropdownSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    parent_name = serializers.SerializerMethodField()
    student_number = serializers.CharField(source='profile.student_number', read_only=True, default='')
    grade_level = serializers.CharField(source='profile.grade_level', read_only=True, default='')
    payment_mode = serializers.CharField(source='profile.payment_mode', read_only=True, default='')

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'student_name',
            'parent_name',
            'student_number',
            'grade_level',
            'payment_mode',
        ]

    def get_student_name(self, obj):
        try:
            p = obj.profile
            name = f"{p.student_first_name} {p.student_last_name}".strip()
            return name if name else ""
        except (UserProfile.DoesNotExist, AttributeError):
            return ""

    def get_parent_name(self, obj):
        try:
            p = obj.profile
            name = f"{p.parent_first_name} {p.parent_last_name}".strip()
            return name if name else ""
        except (UserProfile.DoesNotExist, AttributeError):
            return ""

class TuitionConfigSerializer(serializers.ModelSerializer):
    created_date = serializers.DateTimeField(format="%Y-%m-%d %H:%M", read_only=True)
    updated_date = serializers.DateTimeField(format="%Y-%m-%d %H:%M", read_only=True)

    class Meta:
        model = TuitionConfig
        fields = [
            'id',
            'grade_key',
            'grade_label',
            'cash',
            'installment',
            'initial',
            'monthly',
            'reservation_fee',
            'misc_aug',
            'misc_nov',
            'assessment',
            'total_cash',
            'total_installment',
            'description',
            'status',
            'is_active',
            'created_date',
            'updated_date',
        ]
        read_only_fields = ['total_cash', 'total_installment', 'created_date', 'updated_date']


class TuitionConfigCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TuitionConfig
        fields = [
            'grade_key',
            'grade_label',
            'cash',
            'installment',
            'initial',
            'monthly',
            'reservation_fee',
            'misc_aug',
            'misc_nov',
            'assessment',
            'description',
            'status',
            'is_active',
        ]

    def validate(self, attrs):
        cash = Decimal(str(attrs.get('cash', 0) or 0))
        installment = Decimal(str(attrs.get('installment', 0) or 0))
        initial = Decimal(str(attrs.get('initial', 0) or 0))
        monthly = Decimal(str(attrs.get('monthly', 0) or 0))
        misc_aug = Decimal(str(attrs.get('misc_aug', 0) or 0))
        misc_nov = Decimal(str(attrs.get('misc_nov', 0) or 0))

        if cash < 0 or installment < 0 or initial < 0 or monthly < 0 or misc_aug < 0 or misc_nov < 0:
            raise serializers.ValidationError("Tuition amounts cannot be negative.")

        expected_installment = initial + (monthly * Decimal('10'))
        if installment != expected_installment:
            raise serializers.ValidationError({
                'installment': (
                    f'Installment must equal initial + (monthly × 10). '
                    f'Expected: {expected_installment}.'
                )
            })

        return attrs


class ProofOfPaymentSerializer(serializers.ModelSerializer):
    """Serializer for reading/displaying ProofOfPayment submissions."""
    parent_username = serializers.CharField(source='parent.username', read_only=True)
    transaction_details = serializers.SerializerMethodField(read_only=True)
    reviewed_by_username = serializers.CharField(
        source='reviewed_by.username',
        read_only=True,
        allow_null=True
    )
    submitted_date = serializers.DateTimeField(format="%Y-%m-%d %H:%M", read_only=True)
    reviewed_date = serializers.DateTimeField(format="%Y-%m-%d %H:%M", read_only=True, allow_null=True)
    payment_date = serializers.DateField(format="%Y-%m-%d")

    class Meta:
        model = ProofOfPayment
        fields = [
            'id',
            'parent',
            'parent_username',
            'transaction',
            'transaction_details',
            'reference_number',
            'payment_amount',
            'payment_date',
            'payment_method',
            'document',
            'description',
            'status',
            'rejection_reason',
            'submitted_date',
            'reviewed_date',
            'reviewed_by',
            'reviewed_by_username',
        ]
        read_only_fields = [
            'id',
            'submitted_date',
            'reviewed_date',
            'reviewed_by',
        ]

    def get_transaction_details(self, obj):
        """Return a summary of the related transaction."""
        if obj.transaction:
            return {
                'id': obj.transaction.id,
                'type': obj.transaction.transaction_type,
                'item': obj.transaction.item,
                'amount': str(obj.transaction.amount),
                'reference_number': obj.transaction.reference_number,
                'status': obj.transaction.status,
            }
        return None


class ProofOfPaymentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/submitting new ProofOfPayment documents."""
    payment_date = serializers.DateField(format="%Y-%m-%d")

    class Meta:
        model = ProofOfPayment
        fields = [
            'transaction',
            'reference_number',
            'payment_amount',
            'payment_date',
            'payment_method',
            'document',
            'description',
        ]

    def validate_transaction(self, value):
        """Ensure transaction exists and belongs to authenticated user."""
        # The parent will be set from request.user in the view
        return value

    def validate_payment_amount(self, value):
        """Ensure payment amount is positive."""
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than 0.")
        return value

    def validate_document(self, value):
        """Validate document file size and format."""
        # Max file size: 5MB
        max_size = 5 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("File size must not exceed 5MB.")

        # Allowed file types
        allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(
                "Only JPEG, PNG, and PDF files are allowed."
            )
        return value

    def validate(self, attrs):
        """Additional validation for the submission."""
        transaction = attrs.get('transaction')

        # Check if proof already exists
        if ProofOfPayment.objects.filter(transaction=transaction).exists():
            raise serializers.ValidationError({
                'transaction': 'A proof of payment has already been submitted for this transaction.'
            })

        return attrs

    def create(self, validated_data):
        """Create new proof of payment with parent from request."""
        validated_data['parent'] = self.context['request'].user
        return super().create(validated_data)


class ProofOfPaymentReviewSerializer(serializers.ModelSerializer):
    """Serializer for admin review/approval of payment proofs."""

    class Meta:
        model = ProofOfPayment
        fields = [
            'id',
            'status',
            'rejection_reason',
        ]

    def validate_status(self, value):
        """Validate status transitions."""
        allowed_statuses = ['APPROVED', 'REJECTED', 'RESUBMIT']
        if value not in allowed_statuses:
            raise serializers.ValidationError(
                f"Admin can only set status to: {', '.join(allowed_statuses)}"
            )
        return value

    def validate(self, attrs):
        """Ensure rejection_reason is provided when rejecting."""
        status = attrs.get('status')
        rejection_reason = attrs.get('rejection_reason', '')

        if status in ['REJECTED', 'RESUBMIT'] and not rejection_reason.strip():
            raise serializers.ValidationError({
                'rejection_reason': 'Reason is required when rejecting or requesting resubmission.'
            })

        return attrs

    def update(self, instance, validated_data):
        """Update proof status and set review details."""
        from django.utils import timezone
        validated_data['reviewed_by'] = self.context['request'].user
        validated_data['reviewed_date'] = timezone.now()
        return super().update(instance, validated_data)