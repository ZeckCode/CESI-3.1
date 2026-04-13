# accounts/serializers.py
from django.db import models
from django.utils.text import slugify
from rest_framework import serializers
from .models import User, UserProfile, TeacherProfile, AdminProfile, Section, Subject, PasswordResetRequest
from classmanagement.models import Schedule, SchoolYear

# Enrollment
from enrollment.models import Enrollment


# ── Read-only serializers ──────────────────────────────

class SubjectTeacherSerializer(serializers.Serializer):
    """Lightweight teacher info nested inside a subject."""
    id = serializers.IntegerField(source="user.id")
    username = serializers.CharField(source="user.username")
    employee_id = serializers.CharField()


class SubjectLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "code"]


class SubjectSerializer(serializers.ModelSerializer):
    teachers = serializers.SerializerMethodField()
    assigned_teacher = serializers.IntegerField(
        write_only=True, required=False, allow_null=True,
    )
    assigned_teachers = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Subject
        fields = ["id", "name", "code", "teachers", "assigned_teacher", "assigned_teachers"]

    @staticmethod
    def _strip_assignment_fields(validated_data):
        # Assignment is applied in views after subject save.
        validated_data.pop("assigned_teacher", None)
        validated_data.pop("assigned_teachers", None)
        return validated_data

    def create(self, validated_data):
        clean_data = self._strip_assignment_fields(dict(validated_data))
        return super().create(clean_data)

    def update(self, instance, validated_data):
        clean_data = self._strip_assignment_fields(dict(validated_data))
        return super().update(instance, clean_data)

    def get_teachers(self, obj):
        teacher_profiles = TeacherProfile.objects.select_related("user").filter(
            models.Q(subject=obj) | models.Q(subjects=obj)
        ).distinct()
        return SubjectTeacherSerializer(teacher_profiles, many=True).data


class SectionSerializer(serializers.ModelSerializer):
    adviser = serializers.PrimaryKeyRelatedField(
        queryset=TeacherProfile.objects.all(),
        allow_null=True,
        required=False,
        validators=[],
    )
    adviser_name = serializers.SerializerMethodField(read_only=True)
    student_count = serializers.SerializerMethodField()
    is_full = serializers.SerializerMethodField()
    student_ids = serializers.SerializerMethodField()
    student_names = serializers.SerializerMethodField()
    capacity = serializers.IntegerField(required=False)
    grade_level = serializers.ChoiceField(choices=Section.GRADE_LEVEL_CHOICES)
    grade_level_display = serializers.CharField(source="get_grade_level_display", read_only=True)
    room_code = serializers.CharField(source="room.code", read_only=True, allow_null=True)
    room_name = serializers.CharField(source="room.name", read_only=True, allow_null=True)
    school_year_name = serializers.CharField(source="school_year.name", read_only=True, allow_null=True)

    class Meta:
        model = Section
        fields = [
            "id", "name", "grade_level", "grade_level_display",
            "capacity",
            "school_year", "school_year_name",
            "room", "room_code", "room_name",
            "adviser", "adviser_name",
            "student_count", "is_full",
            "student_ids", "student_names",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)

        current_id = getattr(self.instance, "id", None)
        adviser_in_payload = "adviser" in attrs
        adviser = attrs.get("adviser", getattr(self.instance, "adviser", None))
        room = attrs.get("room", getattr(self.instance, "room", None))
        school_year = attrs.get("school_year", getattr(self.instance, "school_year", None))

        if adviser_in_payload and adviser is not None:
            # Strict rule: adviser assignment is only valid if the teacher already
            # has at least one schedule in this exact section and school year.
            if self.instance is None:
                raise serializers.ValidationError(
                    {
                        "adviser": (
                            "Assign adviser after creating the section and adding at least "
                            "one schedule for that teacher in this section."
                        )
                    }
                )

            schedule_qs = Schedule.objects.filter(
                teacher_id=adviser.user_id,
                section_id=self.instance.id,
            )

            if school_year is not None:
                schedule_qs = schedule_qs.filter(school_year=school_year)
            else:
                active_sy = SchoolYear.objects.filter(is_active=True).first()
                if active_sy is not None:
                    schedule_qs = schedule_qs.filter(school_year=active_sy)

            if not schedule_qs.exists():
                raise serializers.ValidationError(
                    {
                        "adviser": (
                            "This teacher cannot be assigned as adviser yet. "
                            "They need at least one schedule in this section and school year."
                        )
                    }
                )

        if adviser is not None:
            adviser_conflict_qs = Section.objects.filter(adviser=adviser)
            if current_id is not None:
                adviser_conflict_qs = adviser_conflict_qs.exclude(id=current_id)
            if adviser_conflict_qs.exists():
                raise serializers.ValidationError(
                    {"adviser": "This homeroom teacher is already assigned to another section."}
                )

        if room is not None:
            room_conflict_qs = Section.objects.filter(room=room)
            if current_id is not None:
                room_conflict_qs = room_conflict_qs.exclude(id=current_id)

            if school_year is not None:
                room_conflict_qs = room_conflict_qs.filter(school_year=school_year)
            else:
                room_conflict_qs = room_conflict_qs.filter(school_year__isnull=True)

            if room_conflict_qs.exists():
                raise serializers.ValidationError(
                    {"room": "This room is already assigned to another section for the selected school year."}
                )

        return attrs

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
        fields = ["id", "username", "first_name", "last_name", "email", "role", "status", "created_at"]


class AdminProfileReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminProfile
        fields = ["id", "permissions_level"]


class TeacherProfileReadSerializer(serializers.ModelSerializer):
    """Nested read-only representation returned inside UserDetailSerializer."""
    subject = SubjectSerializer(read_only=True)
    subjects = serializers.SerializerMethodField()
    section = SectionSerializer(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = TeacherProfile
        fields = ["id", "employee_id", "subject", "subjects", "section", "avatar", "avatar_url"]

    def get_subjects(self, obj):
        subjects = list(obj.subjects.all())
        if obj.subject and all(s.id != obj.subject_id for s in subjects):
            subjects.insert(0, obj.subject)
        return SubjectLiteSerializer(subjects, many=True).data

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class UserProfileReadSerializer(serializers.ModelSerializer):
    section = SectionSerializer(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    transfer_clearance_url = serializers.SerializerMethodField()

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
            "transfer_status", "is_read_only",
            "transfer_date", "transfer_reason",
            "destination_school_name", "destination_school_address", "destination_school_contact",
            "transfer_reference_number", "transfer_notes",
            "allow_transfer_with_balance", "outstanding_balance_snapshot",
            "transfer_requested_at", "transfer_approved_at", "transfer_approved_by",
            "transfer_clearance", "transfer_clearance_url",
            "avatar", "avatar_url",
        ]

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_transfer_clearance_url(self, obj):
        if obj.transfer_clearance:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.transfer_clearance.url)
            return obj.transfer_clearance.url
        return None


class UserDetailSerializer(serializers.ModelSerializer):
    """
    Full user + nested profile + current enrollment for parent/student.
    """
    teacher_profile = TeacherProfileReadSerializer(read_only=True)
    profile = UserProfileReadSerializer(read_only=True)
    admin_profile = AdminProfileReadSerializer(read_only=True)
    enrollment = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "status",
            "created_at",
            "teacher_profile",
            "profile",
            "admin_profile",
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
    subjects = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )
    section = serializers.IntegerField(required=False, allow_null=True)
    employee_id = serializers.CharField(required=False, allow_blank=True)

    def validate_subject(self, value):
        if value is not None and not Subject.objects.filter(id=value).exists():
            raise serializers.ValidationError("Subject not found")
        return value

    def validate_subjects(self, values):
        unique_values = []
        for value in (values or []):
            try:
                subject_id = int(value)
            except (TypeError, ValueError):
                continue
            if subject_id > 0:
                unique_values.append(subject_id)

        unique_values = list(dict.fromkeys(unique_values))
        if not unique_values:
            return []

        found_ids = set(Subject.objects.filter(id__in=unique_values).values_list("id", flat=True))
        missing = [v for v in unique_values if v not in found_ids]
        if missing:
            raise serializers.ValidationError(
                "One or more selected subjects no longer exist. Please reselect subjects and try again."
            )
        return unique_values

    def validate_section(self, value):
        if value is not None and not Section.objects.filter(id=value).exists():
            raise serializers.ValidationError("Section not found")
        return value


class AdminProfileUpdateSerializer(serializers.Serializer):
    """Update an admin account's editable fields."""
    username = serializers.CharField(max_length=50, required=False)
    first_name = serializers.CharField(max_length=50, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=50, required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    current_password = serializers.CharField(required=False, allow_blank=True)
    new_password = serializers.CharField(required=False, allow_blank=True, min_length=8)
    confirm_password = serializers.CharField(required=False, allow_blank=True, min_length=8)

    def validate(self, attrs):
        new_password = (attrs.get("new_password") or "").strip()
        confirm_password = (attrs.get("confirm_password") or "").strip()
        current_password = (attrs.get("current_password") or "").strip()

        if new_password or confirm_password or current_password:
            if not current_password:
                raise serializers.ValidationError({"current_password": "Current password is required."})
            if not new_password:
                raise serializers.ValidationError({"new_password": "New password is required."})
            if not confirm_password:
                raise serializers.ValidationError({"confirm_password": "Please confirm the new password."})
            if new_password != confirm_password:
                raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        return attrs


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
        if value is not None and not Section.objects.filter(id=value).exists():
            raise serializers.ValidationError("Section not found")
        return value


class StudentTransferDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["PENDING", "APPROVED", "REJECTED"])
    transfer_date = serializers.DateField(required=False, allow_null=True)
    transfer_reason = serializers.CharField(required=False, allow_blank=True)
    destination_school_name = serializers.CharField(required=False, allow_blank=True)
    destination_school_address = serializers.CharField(required=False, allow_blank=True)
    destination_school_contact = serializers.CharField(required=False, allow_blank=True)
    transfer_reference_number = serializers.CharField(required=False, allow_blank=True)
    transfer_notes = serializers.CharField(required=False, allow_blank=True)
    allow_transfer_with_balance = serializers.BooleanField(required=False, default=False)


class StudentTransferRequestSerializer(serializers.Serializer):
    transfer_reason = serializers.CharField(required=True, allow_blank=False)
    destination_school_name = serializers.CharField(required=True, allow_blank=False)
    destination_school_address = serializers.CharField(required=False, allow_blank=True)
    destination_school_contact = serializers.CharField(required=False, allow_blank=True)
    transfer_reference_number = serializers.CharField(required=False, allow_blank=True)
    transfer_notes = serializers.CharField(required=False, allow_blank=True)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class CreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50, required=False, allow_blank=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=["ADMIN", "TEACHER", "PARENT_STUDENT"])
    status = serializers.ChoiceField(
        choices=["NEW", "ACTIVE", "INACTIVE", "SUSPENDED", "TRANSFERRED"],
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
    subjects = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)
    section_teacher = serializers.IntegerField(required=False)
    employee_id = serializers.CharField(max_length=50, required=False, allow_blank=True)

    @staticmethod
    def _build_student_username_base(first_name, last_name):
        safe_last = slugify(str(last_name or "").strip()).replace("-", "")
        safe_first = slugify(str(first_name or "").strip()).replace("-", "")
        base = "_".join(part for part in [safe_last, safe_first] if part).strip("_")
        return base or "student_user"

    @staticmethod
    def _generate_unique_student_username(first_name, last_name):
        max_len = User._meta.get_field("username").max_length
        base = CreateUserSerializer._build_student_username_base(first_name, last_name)[:max_len]

        candidate = base
        counter = 1
        while User.objects.filter(username__iexact=candidate).exists():
            suffix = str(counter)
            trimmed = base[: max_len - len(suffix)]
            candidate = f"{trimmed}{suffix}"
            counter += 1
        return candidate

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
                raise serializers.ValidationError(
                    {"detail": f"Missing profile fields: {', '.join(missing)}"}
                )

            section_id = attrs.get("section")
            if section_id:
                try:
                    Section.objects.get(id=section_id)
                except Section.DoesNotExist:
                    raise serializers.ValidationError({"section": "Section not found"})

            attrs["username"] = self._generate_unique_student_username(
                attrs.get("student_first_name"),
                attrs.get("student_last_name"),
            )

        elif role == "TEACHER":
            username = (attrs.get("username") or "").strip()
            if not username:
                raise serializers.ValidationError({"username": "Username is required for teacher accounts."})
            attrs["username"] = username

            subject_id = attrs.get("subject")
            if subject_id:
                try:
                    Subject.objects.get(id=subject_id)
                except Subject.DoesNotExist:
                    raise serializers.ValidationError({"subject": "Subject not found"})

            subject_ids = []
            for value in (attrs.get("subjects") or []):
                try:
                    subject_id = int(value)
                except (TypeError, ValueError):
                    continue
                if subject_id > 0:
                    subject_ids.append(subject_id)

            subject_ids = list(dict.fromkeys(subject_ids))
            attrs["subjects"] = subject_ids
            if subject_ids:
                found_ids = set(Subject.objects.filter(id__in=subject_ids).values_list("id", flat=True))
                missing_ids = [sid for sid in subject_ids if sid not in found_ids]
                if missing_ids:
                    raise serializers.ValidationError(
                        {
                            "subjects": "One or more selected subjects no longer exist. "
                            "Please reselect subjects and try again."
                        }
                    )

            section_id = attrs.get("section_teacher")
            if section_id:
                try:
                    Section.objects.get(id=section_id)
                except Section.DoesNotExist:
                    raise serializers.ValidationError({"section_teacher": "Section not found"})

        else:
            username = (attrs.get("username") or "").strip()
            if not username:
                raise serializers.ValidationError({"username": "Username is required."})
            attrs["username"] = username

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
            teacher_fields = ["subject", "subjects", "section_teacher", "employee_id"]
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
            subject_ids = list(dict.fromkeys(teacher_profile_data.get("subjects") or []))
            subject_obj = None
            if teacher_profile_data.get("subject"):
                subject_obj = Subject.objects.get(id=teacher_profile_data.get("subject"))
            elif subject_ids:
                subject_obj = Subject.objects.filter(id__in=subject_ids).order_by("id").first()

            section_obj = None
            if teacher_profile_data.get("section_teacher"):
                section_obj = Section.objects.get(id=teacher_profile_data.get("section_teacher"))

            teacher_profile = TeacherProfile.objects.create(
                user=user,
                subject=subject_obj,
                section=section_obj,
                employee_id=teacher_profile_data.get("employee_id", ""),
            )

            if subject_ids:
                teacher_profile.subjects.set(Subject.objects.filter(id__in=subject_ids))
            elif subject_obj:
                teacher_profile.subjects.set([subject_obj])

        return user


class PasswordResetRequestCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50)
    email = serializers.EmailField()
    message = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        username = (attrs.get("username") or "").strip()
        email = (attrs.get("email") or "").strip().lower()

        if not username:
            raise serializers.ValidationError({"username": "Username is required."})

        user = User.objects.filter(username__iexact=username).first()
        if not user:
            raise serializers.ValidationError(
                {"detail": "No account found with this username."}
            )

        # Allow shared recipient emails by validating enrollment contact email too.
        matches_user_email = (user.email or "").strip().lower() == email
        matches_enrollment_email = Enrollment.objects.filter(
            student=user,
            email__iexact=email,
        ).exists()

        if not (matches_user_email or matches_enrollment_email):
            raise serializers.ValidationError(
                {"detail": "This email does not match the selected username."}
            )

        attrs["username"] = username
        attrs["email"] = email
        attrs["recipient_email"] = email
        attrs["user"] = user
        return attrs


class PasswordResetRequestSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    account_email = serializers.SerializerMethodField()
    email_matches_account = serializers.SerializerMethodField()

    class Meta:
        model = PasswordResetRequest
        fields = [
            "id",
            "user",
            "user_name",
            "email",
            "account_email",
            "email_matches_account",
            "message",
            "status",
            "requested_at",
            "sent_at",
            "completed_at",
        ]

    def get_account_email(self, obj):
        return (getattr(obj.user, "email", "") or "").strip()

    def get_email_matches_account(self, obj):
        request_email = (obj.email or "").strip().lower()
        account_email = (getattr(obj.user, "email", "") or "").strip().lower()
        return bool(request_email and account_email and request_email == account_email)

    def get_user_name(self, obj):
        user = obj.user

        full_name = " ".join(
            part for part in [
                getattr(user, "first_name", ""),
                getattr(user, "last_name", ""),
            ]
            if part
        ).strip()

        if full_name:
            return full_name

        if getattr(user, "role", None) == "PARENT_STUDENT" and hasattr(user, "profile") and user.profile:
            student_name = " ".join(
                part for part in [
                    getattr(user.profile, "student_first_name", ""),
                    getattr(user.profile, "student_last_name", ""),
                ]
                if part
            ).strip()
            if student_name:
                return student_name

            parent_name = " ".join(
                part for part in [
                    getattr(user.profile, "parent_first_name", ""),
                    getattr(user.profile, "parent_last_name", ""),
                ]
                if part
            ).strip()
            if parent_name:
                return parent_name

        return getattr(user, "username", "") or getattr(user, "email", "Unknown User")