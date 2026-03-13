from rest_framework import serializers
from django.utils import timezone
import re

from .models import Enrollment, ParentInfo
from accounts.models import User
from accounts.serializers import UserSerializer
from enrollment.models import EnrollmentSettings
# -------------------- Helpers --------------------
PRESCHOOL = {"prek", "kinder"}
ELEMENTARY = {"grade1", "grade2", "grade3", "grade4", "grade5", "grade6"}

# Allow digits + basic symbols for telephone; we will do strict PH for mobile below
PHONE_RE = re.compile(r"^[0-9+\-\s()]{7,20}$")

# Strict PH mobile:
# - 09XXXXXXXXX (11 digits) OR
# - +639XXXXXXXXX (13 chars)
PH_MOBILE_RE = re.compile(r"^(09\d{9}|\+639\d{9})$")


def normalize_ph_mobile(value: str | None):
    """
    Accept:
      - 09xxxxxxxxx -> +639xxxxxxxxx
      - +639xxxxxxxxx -> keep
    Return normalized +639... or None if invalid/empty.
    """
    if not value:
        return None
    cleaned = re.sub(r"\s+", "", str(value))

    if re.fullmatch(r"09\d{9}", cleaned):
        return "+63" + cleaned[1:]  # 09xxxxxxxxx -> +639xxxxxxxxx

    if re.fullmatch(r"\+639\d{9}", cleaned):
        return cleaned

    return None


# -------------------- Serializers --------------------
class ParentInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParentInfo
        fields = [
            "father_name", "father_contact", "father_occupation",
            "mother_name", "mother_contact", "mother_occupation",
            "guardian_name", "guardian_contact", "guardian_relationship",
        ]


class EnrollmentSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    parent_info = ParentInfoSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = "__all__"


class EnrollmentDetailedSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    section_details = serializers.SerializerMethodField()
    parent_info = ParentInfoSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = "__all__"

    def get_section_details(self, obj):
        return {
            "id": obj.section.id if obj.section else None,
            "name": obj.section.name if obj.section else "No Section",
            "grade_level": obj.section.grade_level if obj.section else None,
        }


class EnrollmentCreateSerializer(serializers.ModelSerializer):
    # accept nested parent_info on POST/PATCH
    parent_info = ParentInfoSerializer(required=False)

    # honeypot (NOT a model field)
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Enrollment
        fields = "__all__"
        extra_kwargs = {
            "student": {"required": False, "allow_null": True},
            "section": {"required": False, "allow_null": True},
            "status": {"required": False},
        }

    # -------------------- Validations --------------------
    def validate(self, attrs):
        # 1) Honeypot bot check
        if attrs.get("website"):
            raise serializers.ValidationError("Invalid submission.")

        # ✅ remove honeypot so it never reaches model create/update
        attrs.pop("website", None)

        # 2) Required core fields
        required = [
                "first_name",
                "last_name",
                "education_level",
                "grade_level",
                "student_type",
                "payment_mode",
            ]

        if not self.instance:  # only required during create
                errors = {f: "This field is required." for f in required if not attrs.get(f)}
                if errors:
                    raise serializers.ValidationError(errors)

        # 3) Birth date validation (past + age range)
        bd = attrs.get("birth_date")
        if bd:
            today = timezone.localdate()

            if bd >= today:
                raise serializers.ValidationError({"birth_date": "Birth date must be in the past."})

            # accurate age calc
            age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))

            # Adjust these limits to your school policy
            if age < 3:
                raise serializers.ValidationError({"birth_date": "Student must be at least 3 years old."})
            if age > 18:
                raise serializers.ValidationError({"birth_date": "Student age exceeds allowed school range."})

        # 4) Grade must match education level
        edu = attrs.get("education_level")
        grade = attrs.get("grade_level")

        if edu == "preschool" and grade not in PRESCHOOL:
            raise serializers.ValidationError({"grade_level": "For Preschool, grade must be Pre-Kinder or Kinder."})
        if edu == "elementary" and grade not in ELEMENTARY:
            raise serializers.ValidationError({"grade_level": "For Elementary, grade must be Grade 1–6."})

      # 5) At least one student contact method
        mobile_number = attrs.get("mobile_number", getattr(self.instance, "mobile_number", None))
        telephone_number = attrs.get("telephone_number", getattr(self.instance, "telephone_number", None))
        email = attrs.get("email", getattr(self.instance, "email", None))

        if not (mobile_number or telephone_number or email):
            raise serializers.ValidationError(
                {"contact": "Provide at least one contact: mobile number, telephone number, or email."}
            )

        # 6) Mobile PH validation + normalize to +639...
        if mobile_number:
            normalized = normalize_ph_mobile(mobile_number)
            if not normalized:
                raise serializers.ValidationError(
                    {"mobile_number": "Invalid PH mobile. Use 09XXXXXXXXX or +639XXXXXXXXX."}
                )
            attrs["mobile_number"] = normalized

        # 7) Telephone format validation (if provided)
        if telephone_number and not PHONE_RE.match(telephone_number):
            raise serializers.ValidationError({"telephone_number": "Invalid phone format."})

        # 8) Parent/Guardian: if parent_info exists, require at least one contact
        parent_info = attrs.get("parent_info", None)
        if parent_info is not None:
            has_parent_contact = any([
                parent_info.get("father_contact"),
                parent_info.get("mother_contact"),
                parent_info.get("guardian_contact"),
            ])
            if not has_parent_contact:
                raise serializers.ValidationError(
                    {"parent_info": "Provide at least one parent/guardian contact number."}
                )

            # Optional: validate parent/guardian contact formats
            for field in ["father_contact", "mother_contact", "guardian_contact"]:
                val = parent_info.get(field)
                if val and not PHONE_RE.match(val):
                    raise serializers.ValidationError({"parent_info": {field: "Invalid phone format."}})

        return attrs

    # -------------------- Create / Update --------------------
    def create(self, validated_data):
        validated_data.pop("website", None)
        parent_data = validated_data.pop("parent_info", None)

        # Temporary placeholder student user for public enrollment submissions
        public_user, created = User.objects.get_or_create(
            username="public_user",
            defaults={
                "email": "public@school.com",
                "role": "PARENT_STUDENT",
                "status": "ACTIVE",
                "is_active": True,
            },
        )

        # Safety: if public_user already exists but has no usable email/role, keep it valid
        updated_fields = []
        if not public_user.email:
            public_user.email = "public@school.com"
            updated_fields.append("email")
        if public_user.role not in ["ADMIN", "TEACHER", "PARENT_STUDENT"]:
            public_user.role = "PARENT_STUDENT"
            updated_fields.append("role")
        if updated_fields:
            public_user.save(update_fields=updated_fields)

        validated_data["student"] = public_user
        validated_data["status"] = "PENDING"

        possible_duplicate = Enrollment.objects.filter(
            first_name__iexact=validated_data.get("first_name"),
            last_name__iexact=validated_data.get("last_name"),
            birth_date=validated_data.get("birth_date"),
            academic_year=validated_data.get("academic_year"),
        ).exists()

        if possible_duplicate:
            existing_remarks = validated_data.get("remarks", "") or ""
            validated_data["remarks"] = (existing_remarks + " | POSSIBLE DUPLICATE ENROLLMENT").strip(" |")

        enrollment = super().create(validated_data)

        if parent_data:
            ParentInfo.objects.create(enrollment=enrollment, **parent_data)

        return enrollment
    
    def update(self, instance, validated_data):
        # ✅ final safety
        validated_data.pop("website", None)

        parent_data = validated_data.pop("parent_info", None)

        instance = super().update(instance, validated_data)

        if parent_data is not None:
            ParentInfo.objects.update_or_create(
                enrollment=instance,
                defaults=parent_data
            )

        return instance
    
    
from .models import EnrollmentSettings  # ← already imported via models


class EnrollmentSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EnrollmentSettings
        fields = ["open_date", "window_days", "academic_year", "updated_at"]
        read_only_fields = ["updated_at"]