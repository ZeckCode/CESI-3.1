# finance/serializers.py
from decimal import Decimal
from django.db.models import Sum
from django.contrib.auth import get_user_model
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
    student_number = serializers.SerializerMethodField()
    payment_mode = serializers.SerializerMethodField()
    grade_level = serializers.SerializerMethodField()
    student_type = serializers.CharField(source='student_type_snapshot', read_only=True)
    enrollment_id = serializers.IntegerField(read_only=True)
    
    
    def get_student_number(self, obj):
        if obj.student_number_snapshot:
            return obj.student_number_snapshot
        try:
            return obj.parent.profile.student_number or ''
        except Exception:
            return ''

    def get_payment_mode(self, obj):
        if obj.payment_mode_snapshot:
            return obj.payment_mode_snapshot
        try:
            return obj.parent.profile.payment_mode or ''
        except Exception:
            return ''

    def get_grade_level(self, obj):
        if obj.grade_level_snapshot:
            return obj.grade_level_snapshot
        try:
            return obj.parent.profile.grade_level or ''
        except Exception:
            return ''
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
            'student_type',
            'enrollment_id',

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


# finance/serializers.py
from decimal import Decimal
from django.db.models import Sum
from django.contrib.auth import get_user_model
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
    student_number = serializers.SerializerMethodField()
    payment_mode = serializers.SerializerMethodField()
    grade_level = serializers.SerializerMethodField()
    student_type = serializers.CharField(source='student_type_snapshot', read_only=True)
    enrollment_id = serializers.IntegerField(read_only=True)

    def get_student_number(self, obj):
        if obj.student_number_snapshot:
            return obj.student_number_snapshot
        if obj.enrollment and obj.enrollment.student_number:
            return obj.enrollment.student_number
        try:
            return obj.parent.profile.student_number or ''
        except Exception:
            return ''

    def get_payment_mode(self, obj):
        if obj.payment_mode_snapshot:
            return obj.payment_mode_snapshot
        if obj.enrollment and obj.enrollment.payment_mode:
            return obj.enrollment.payment_mode
        try:
            return obj.parent.profile.payment_mode or ''
        except Exception:
            return ''

    def get_grade_level(self, obj):
        if obj.grade_level_snapshot:
            return obj.grade_level_snapshot
        if obj.enrollment and obj.enrollment.grade_level:
            return obj.enrollment.grade_level
        try:
            return obj.parent.profile.grade_level or ''
        except Exception:
            return ''

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
            'student_type',
            'enrollment_id',

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
            'enrollment',
            'student_number_snapshot',
            'grade_level_snapshot',
            'payment_mode_snapshot',
            'student_type_snapshot',
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
        if validated_data.get('student_name'):
            return

        enrollment = validated_data.get('enrollment') or getattr(self.instance, 'enrollment', None)
        parent = validated_data.get('parent') or getattr(self.instance, 'parent', None)

        if enrollment:
            first_name = enrollment.first_name or ''
            last_name = enrollment.last_name or ''
            full_name = f"{first_name} {last_name}".strip()
            if full_name:
                validated_data['student_name'] = full_name
                return

        if parent:
            try:
                profile = parent.profile
                validated_data['student_name'] = (
                    f"{profile.student_first_name} {profile.student_last_name}"
                ).strip()
                return
            except UserProfile.DoesNotExist:
                validated_data['student_name'] = parent.username

    def _compute_next_balance(self, parent=None, enrollment=None):
        qs = Transaction.objects.all()
        if enrollment:
            qs = qs.filter(enrollment=enrollment)
        elif parent:
            qs = qs.filter(parent=parent)

        totals = qs.aggregate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
        )
        total_debit = Decimal(str(totals.get('total_debit') or 0))
        total_credit = Decimal(str(totals.get('total_credit') or 0))
        return total_debit - total_credit

    def validate(self, attrs):
        parent = attrs.get('parent') or getattr(self.instance, 'parent', None)
        enrollment = attrs.get('enrollment') or getattr(self.instance, 'enrollment', None)
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

        if entry_type == 'CREDIT' and item in {'REGISTRATION', 'MONTHLY', 'MISC', 'RESERVATION', 'ASSESSMENT', 'REFUND'}:
            raise serializers.ValidationError({'item': f'{item} is normally a DEBIT billing entry.'})

        if not parent or transaction_type != 'TUITION':
            return attrs

        payment_mode = ''
        grade_key = ''

        if enrollment:
            payment_mode = (enrollment.payment_mode or '').strip().lower()
            grade_key = (enrollment.grade_level or '').strip().lower()
        else:
            try:
                profile = parent.profile
                payment_mode = (profile.payment_mode or '').strip().lower()
                grade_key = (profile.grade_level or '').strip().lower()
            except UserProfile.DoesNotExist:
                raise serializers.ValidationError("Parent/student profile not found.")

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
            if entry_type == 'CREDIT' and item == 'PAYMENT' and due_date:
                raise serializers.ValidationError({
                    'due_date': 'Due date is not allowed for cash payment entries.'
                })

        elif payment_mode == 'installment':
            initial = Decimal(str(tuition.initial or 0))
            monthly = Decimal(str(tuition.monthly or 0))
            misc_aug = Decimal(str(tuition.misc_aug or 0))
            misc_nov = Decimal(str(tuition.misc_nov or 0))
            total_installment = Decimal(str(tuition.total_installment or 0))

            # Allow flexible custom amount for PAYMENT
            if entry_type == 'CREDIT':
                if item == 'PAYMENT':
                    if amount <= 0:
                        raise serializers.ValidationError({
                            'amount': 'Payment amount must be greater than 0.'
                        })
                elif item == 'INITIAL' and amount != initial:
                    raise serializers.ValidationError({
                        'amount': f'Initial credit must equal initial amount: {initial}.'
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

        enrollment = validated_data.get('enrollment')
        parent = validated_data.get('parent')

        if enrollment:
            validated_data.setdefault('student_number_snapshot', enrollment.student_number)
            validated_data.setdefault('grade_level_snapshot', enrollment.grade_level)
            validated_data.setdefault('payment_mode_snapshot', enrollment.payment_mode)
            validated_data.setdefault('student_type_snapshot', enrollment.student_type)
            validated_data.setdefault('school_year', enrollment.academic_year)

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

        tx.balance = self._compute_next_balance(parent=parent, enrollment=enrollment)
        tx.save(update_fields=['balance'])

        return tx

    def update(self, instance, validated_data):
        self._auto_fill_student_name(validated_data)
        tx = super().update(instance, validated_data)

        qs = Transaction.objects.all()
        if tx.enrollment_id:
            qs = qs.filter(enrollment=tx.enrollment)
        else:
            qs = qs.filter(parent=tx.parent)

        totals = qs.order_by('transaction_date', 'date_posted', 'id')

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

User = get_user_model()

class ProofOfPaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_username = serializers.SerializerMethodField()
    student_grade = serializers.SerializerMethodField()
    proof_image_url = serializers.SerializerMethodField()
    enrollment_id = serializers.SerializerMethodField()
    
    # Add these new fields
    payment_type = serializers.CharField(read_only=True)
    source = serializers.CharField(read_only=True)
    
    class Meta:
        model = ProofOfPayment
        fields = [
            'id', 'reference_number', 'description', 'proof_image', 
            'proof_image_url', 'status', 'admin_remarks', 
            'created_at', 'updated_at', 'student_name', 'student_username', 
            'student_grade', 'enrollment_id', 'payment_type', 'source'  # Added payment_type and source
        ]
        read_only_fields = ['id', 'status', 'admin_remarks', 'created_at', 'updated_at', 
                           'student_name', 'student_username', 'student_grade', 
                           'enrollment_id', 'payment_type', 'source']
    
    def _get_enrollment(self, obj):
        """Helper to fetch enrollment from reference_number or direct relation"""
        # First check if enrollment is directly linked
        if hasattr(obj, 'enrollment') and obj.enrollment:
            return obj.enrollment
        
        # Fallback to parsing reference number
        try:
            from enrollment.models import Enrollment
            if obj.reference_number and obj.reference_number.startswith('ENROLL-'):
                enroll_id = int(obj.reference_number.split('-')[1])
                return Enrollment.objects.get(id=enroll_id)
        except Exception:
            pass
        return None
    
    def get_enrollment_id(self, obj):
        """Extract enrollment ID"""
        if hasattr(obj, 'enrollment') and obj.enrollment:
            return obj.enrollment.id
        
        try:
            if obj.reference_number and obj.reference_number.startswith('ENROLL-'):
                return int(obj.reference_number.split('-')[1])
        except Exception:
            pass
        return None
    
    def get_student_name(self, obj):
        """Get actual student name from enrollment, fall back to user profile"""
        # For enrollment payments, get from linked enrollment
        enrollment = self._get_enrollment(obj)
        if enrollment:
            first_name = enrollment.first_name or ''
            last_name = enrollment.last_name or ''
            full_name = f"{first_name} {last_name}".strip()
            if full_name:
                return full_name
        
        # Fallback to user profile
        try:
            profile = obj.user.profile
            first_name = profile.student_first_name or ''
            last_name = profile.student_last_name or ''
            full_name = f"{first_name} {last_name}".strip()
            if full_name:
                return full_name
            return obj.user.username
        except:
            return obj.user.username
    
    def get_student_username(self, obj):
        return obj.user.username
    
    def get_student_grade(self, obj):
        """Get grade from enrollment"""
        enrollment = self._get_enrollment(obj)
        if enrollment:
            # Grade label mapping
            grade_labels = {
                'prek': 'Pre-K', 'kinder': 'Kinder',
                'grade1': 'Grade 1', 'grade2': 'Grade 2', 'grade3': 'Grade 3',
                'grade4': 'Grade 4', 'grade5': 'Grade 5', 'grade6': 'Grade 6'
            }
            grade_code = (enrollment.grade_level or '').lower()
            return grade_labels.get(grade_code, enrollment.grade_level or '')
        
        # Fallback to user profile
        try:
            profile = obj.user.profile
            return profile.grade_level or ''
        except:
            return ""
    
    def get_proof_image_url(self, obj):
        request = self.context.get('request')
        if obj.proof_image:
            return request.build_absolute_uri(obj.proof_image.url) if request else obj.proof_image.url
        return None