from rest_framework import serializers
from .models import User, UserProfile, TeacherProfile, AdminProfile, Section, Subject

# Enrollment
from enrollment.models import Enrollment


# ── Read-only serializers ──────────────────────────────

class SubjectTeacherSerializer(serializers.Serializer):
    """Lightweight teacher info nested inside a subject."""
    id = serializers.IntegerField(source="user.id")
    username = serializers.CharField(source="user.username")
    employee_id = serializers.CharField()


class SubjectSerializer(serializers.ModelSerializer):
    teachers = SubjectTeacherSerializer(many=True, read_only=True)
    assigned_teacher = serializers.IntegerField(
        write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = Subject
        fields = ["id", "name", "code", "teachers", "assigned_teacher"]


class SectionSerializer(serializers.ModelSerializer):
    adviser_name = serializers.SerializerMethodField(read_only=True)
    student_count = serializers.SerializerMethodField()
    is_full = serializers.SerializerMethodField()
    student_ids = serializers.SerializerMethodField()
    student_names = serializers.SerializerMethodField()
    capacity = serializers.IntegerField(required=False)
    grade_level = serializers.CharField(source="get_grade_level_display", read_only=True)                                                                            
    room_code = serializers.CharField(source="room.code", read_only=True, allow_null=True)
    room_name = serializers.CharField(source="room.name", read_only=True, allow_null=True)

    class Meta:
        model = Section
        fields = [
            "id", "name", "grade_level",
            "capacity",
            "room", "room_code", "room_name",
            "adviser", "adviser_name",
            "student_count", "is_full",
            "student_ids", "student_names",
        ]

    def get_adviser_name(self, obj):
        if obj.adviser and obj.adviser.user:
            return obj.adviser.user.username
        return None

    def get_student_count(self, obj):
        return obj.students.count()

    def get_is_full(self, obj):
        capacity = getattr(obj, "capacity", 0) or 0
        if capacity <= 0:
            return False
        return obj.students.count() >= capacity

    def get_student_ids(self, obj):
        return list(obj.students.values_list("id", flat=True))

    def get_student_names(self, obj):
        return [
            f"{student.student_first_name} {student.student_last_name}".strip()
            for student in obj.students.all()
        ]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "status", "created_at"]


class TeacherProfileReadSerializer(serializers.ModelSerializer):
    """Nested read-only representation returned inside UserDetailSerializer."""
    subject = SubjectSerializer(read_only=True)
    section = SectionSerializer(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = TeacherProfile
        fields = ["id", "employee_id", "subject", "section", "avatar", "avatar_url"]

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class UserProfileReadSerializer(serializers.ModelSerializer):
    section = SectionSerializer(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "student_first_name", "student_middle_name", "student_last_name",
            "grade_level", "section",
            "lrn",
            "student_number",
            "payment_mode",
            "parent_first_name", "parent_middle_name", "parent_last_name",
            "contact_number", "address",
            "avatar", "avatar_url",
        ]

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class UserDetailSerializer(serializers.ModelSerializer):
    """
    Full user + nested profile + current enrollment for parent/student.
    """
    teacher_profile = TeacherProfileReadSerializer(read_only=True)
    profile = UserProfileReadSerializer(read_only=True)
    enrollment = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "status",
            "created_at",
            "teacher_profile",
            "profile",
            "enrollment",
        ]

    def get_enrollment(self, obj):
        if obj.role != "PARENT_STUDENT":
            return None

        enrollment = (
            Enrollment.objects
            .select_related("student", "section", "parent_info", "parent_user")
            .filter(parent_user=obj)
            .order_by("-updated_at", "-created_at")
            .first()
        )

        if not enrollment:
            return None

        from enrollment.serializers import EnrollmentDetailedSerializer
        return EnrollmentDetailedSerializer(enrollment, context=self.context).data


# ── Write serializers ──────────────────────────────────

class TeacherAssignmentSerializer(serializers.Serializer):
    """Update a teacher's subject / section assignment."""
    subject = serializers.IntegerField(required=False, allow_null=True)
    section = serializers.IntegerField(required=False, allow_null=True)
    employee_id = serializers.CharField(required=False, allow_blank=True)

    def validate_subject(self, value):
        if value is not None:
            if not Subject.objects.filter(id=value).exists():
                raise serializers.ValidationError("Subject not found")
        return value

    def validate_section(self, value):
        if value is not None:
            if not Section.objects.filter(id=value).exists():
                raise serializers.ValidationError("Section not found")
        return value


class StudentProfileUpdateSerializer(serializers.Serializer):
    """Update a student's profile fields."""
    student_first_name = serializers.CharField(max_length=50, required=False)
    student_middle_name = serializers.CharField(max_length=50, required=False, allow_blank=True)
    student_last_name = serializers.CharField(max_length=50, required=False)
    grade_level = serializers.CharField(max_length=20, required=False)
    lrn = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    section = serializers.IntegerField(required=False, allow_null=True)
    parent_first_name = serializers.CharField(max_length=50, required=False)
    parent_middle_name = serializers.CharField(max_length=50, required=False, allow_blank=True)
    parent_last_name = serializers.CharField(max_length=50, required=False)
    contact_number = serializers.CharField(max_length=20, required=False)
    email = serializers.EmailField(required=False)

    def validate_section(self, value):
        if value is not None:
            if not Section.objects.filter(id=value).exists():
                raise serializers.ValidationError("Section not found")
        return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class CreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=["ADMIN", "TEACHER", "PARENT_STUDENT"])
    status = serializers.ChoiceField(
        choices=["ACTIVE", "INACTIVE", "SUSPENDED"],
        required=False,
    )

    # Parent/Student profile fields
    student_first_name = serializers.CharField(max_length=50, required=False)
    student_middle_name = serializers.CharField(max_length=50, required=False, allow_blank=True)
    student_last_name = serializers.CharField(max_length=50, required=False)
    grade_level = serializers.CharField(max_length=20, required=False)
    section = serializers.IntegerField(required=False, allow_null=True)

    parent_first_name = serializers.CharField(max_length=50, required=False)
    parent_middle_name = serializers.CharField(max_length=50, required=False, allow_blank=True)
    parent_last_name = serializers.CharField(max_length=50, required=False)
    contact_number = serializers.CharField(max_length=20, required=False)
    address = serializers.CharField(required=False)

    # Teacher profile fields
    subject = serializers.IntegerField(required=False)
    section_teacher = serializers.IntegerField(required=False)
    employee_id = serializers.CharField(max_length=50, required=False, allow_blank=True)

    def validate(self, attrs):
        role = attrs.get("role")

        if role == "PARENT_STUDENT":
            required = [
                "student_first_name",
                "student_last_name",
                "grade_level",
                "parent_first_name",
                "parent_last_name",
                "contact_number",
                "address",
            ]
            missing = [f for f in required if not attrs.get(f)]
            if missing:
                raise serializers.ValidationError({"detail": f"Missing profile fields: {', '.join(missing)}"})

            section_id = attrs.get("section")
            if section_id:
                try:
                    Section.objects.get(id=section_id)
                except Section.DoesNotExist:
                    raise serializers.ValidationError({"section": "Section not found"})

        elif role == "TEACHER":
            subject_id = attrs.get("subject")
            if subject_id:
                try:
                    Subject.objects.get(id=subject_id)
                except Subject.DoesNotExist:
                    raise serializers.ValidationError({"subject": "Subject not found"})

            section_id = attrs.get("section_teacher")
            if section_id:
                try:
                    Section.objects.get(id=section_id)
                except Section.DoesNotExist:
                    raise serializers.ValidationError({"section_teacher": "Section not found"})

        return attrs

    def create(self, validated_data):
        status_value = validated_data.pop("status", "ACTIVE")
        password = validated_data.pop("password")

        parent_profile_data = {}
        teacher_profile_data = {}

        if validated_data.get("role") == "PARENT_STUDENT":
            profile_fields = [
                "student_first_name",
                "student_middle_name",
                "student_last_name",
                "grade_level",
                "section",
                "parent_first_name",
                "parent_middle_name",
                "parent_last_name",
                "contact_number",
                "address",
            ]
            for f in profile_fields:
                if f in validated_data:
                    parent_profile_data[f] = validated_data.pop(f)

        elif validated_data.get("role") == "TEACHER":
            teacher_fields = ["subject", "section_teacher", "employee_id"]
            for f in teacher_fields:
                if f in validated_data:
                    teacher_profile_data[f] = validated_data.pop(f)

        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        user.status = status_value
        user.save()

        if user.role == "PARENT_STUDENT":
            section_obj = None
            if parent_profile_data.get("section"):
                section_obj = Section.objects.get(id=parent_profile_data.get("section"))

            UserProfile.objects.create(
                user=user,
                student_first_name=parent_profile_data.get("student_first_name"),
                student_middle_name=parent_profile_data.get("student_middle_name", ""),
                student_last_name=parent_profile_data.get("student_last_name"),
                grade_level=parent_profile_data.get("grade_level"),
                section=section_obj,
                parent_first_name=parent_profile_data.get("parent_first_name"),
                parent_middle_name=parent_profile_data.get("parent_middle_name", ""),
                parent_last_name=parent_profile_data.get("parent_last_name"),
                contact_number=parent_profile_data.get("contact_number"),
                address=parent_profile_data.get("address"),
            )

        elif user.role == "TEACHER":
            subject_obj = None
            if teacher_profile_data.get("subject"):
                subject_obj = Subject.objects.get(id=teacher_profile_data.get("subject"))

            section_obj = None
            if teacher_profile_data.get("section_teacher"):
                section_obj = Section.objects.get(id=teacher_profile_data.get("section_teacher"))

            TeacherProfile.objects.create(
                user=user,
                subject=subject_obj,
                section=section_obj,
                employee_id=teacher_profile_data.get("employee_id", ""),
            )

        return user