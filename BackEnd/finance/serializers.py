from rest_framework import serializers
from .models import Transaction, TuitionConfig
from accounts.models import User, UserProfile


class TransactionSerializer(serializers.ModelSerializer):
    parent_username = serializers.CharField(source='parent.username', read_only=True)
    date_created = serializers.DateTimeField(format="%Y-%m-%d %H:%M", read_only=True)
    due_date = serializers.DateField(format="%Y-%m-%d", required=False, allow_null=True)

    payment_mode = serializers.CharField(source='parent.profile.payment_mode', read_only=True, default='')
    grade_level = serializers.CharField(source='parent.profile.grade_level', read_only=True, default='')
    
    class Meta:
        model = Transaction
        fields = [
            'id',
            'parent',
            'parent_username',
            'student_name',
            'transaction_type',
            'amount',
            'description',
            'payment_method',
             'grade_level',
             'payment_mode',
            'reference_number',
            'due_date',
            'date_created',
            'status',
        ]


class TransactionCreateSerializer(serializers.ModelSerializer):
    due_date = serializers.DateField(required=False, allow_null=True)
    student_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Transaction
        fields = [
            'parent',
            'student_name',
            'transaction_type',
            'amount',
            'description',
            'payment_method',
            'due_date',
            'status',
        ]

    def validate_parent(self, value):
        if value.role != 'PARENT_STUDENT':
            raise serializers.ValidationError("Selected user is not a Parent/Student account.")
        return value

    def _auto_fill_student_name(self, validated_data):
        if not validated_data.get('student_name'):
            try:
                profile = validated_data['parent'].profile
                validated_data['student_name'] = (
                    f"{profile.student_first_name} {profile.student_last_name}"
                )
            except UserProfile.DoesNotExist:
                validated_data['student_name'] = validated_data['parent'].username

    def create(self, validated_data):
        self._auto_fill_student_name(validated_data)

        if not validated_data.get('reference_number'):
            from django.utils import timezone
            year = timezone.now().year
            last = Transaction.objects.order_by('-id').first()
            seq = (last.id + 1) if last else 1
            validated_data['reference_number'] = f"CESI-{year}-{seq:05d}"

        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._auto_fill_student_name(validated_data)
        return super().update(instance, validated_data)


class ParentDropdownSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    parent_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'student_name', 'parent_name']

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


# ADD THESE NEW SERIALIZERS
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