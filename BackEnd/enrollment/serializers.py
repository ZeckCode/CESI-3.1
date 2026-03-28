from rest_framework import serializers
from django.utils import timezone
import re

from .models import Enrollment, ParentInfo, EnrollmentDocument
from accounts.models import User
from accounts.serializers import UserSerializer
from enrollment.models import EnrollmentSettings

PRESCHOOL = {"prek", "kinder"}
ELEMENTARY = {"grade1", "grade2", "grade3", "grade4", "grade5", "grade6"}

PHONE_RE = re.compile(r"^[0-9+\-\s()]{7,20}$")
PH_MOBILE_RE = re.compile(r"^(09\d{9}|\+639\d{9})$")


def normalize_ph_mobile(value):
    if not value:
        return None
    cleaned = re.sub(r"\s+", "", str(value))

    if re.fullmatch(r"09\d{9}", cleaned):
        return "+63" + cleaned[1:]

    if re.fullmatch(r"\+639\d{9}", cleaned):
        return cleaned

    return None


class ParentInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParentInfo
        fields = [
            "father_name",
            "father_contact",
            "father_occupation",
            "mother_name",
            "mother_contact",
            "mother_occupation",
            "guardian_name",
            "guardian_contact",
            "guardian_relationship",
        ]


class EnrollmentDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnrollmentDocument
        fields = [
            "id",
            "document_type",
            "file",
            "label",
            "uploaded_at",
        ]
        read_only_fields = ["id", "uploaded_at"]


class EnrollmentSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    parent_info = ParentInfoSerializer(read_only=True)
    documents = EnrollmentDocumentSerializer(many=True, read_only=True)
    id_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = "__all__"

    def get_id_image_url(self, obj):
        request = self.context.get("request")
        # Prefer storage URL when available
        try:
            if obj.id_image and obj.id_image.storage.exists(obj.id_image.name):
                url = obj.id_image.url
                return request.build_absolute_uri(url) if request else url
        except Exception:
            pass

        if getattr(obj, "id_image_data", None):
            if request:
                return request.build_absolute_uri(f"/api/enrollments/{obj.pk}/id_image/")
            return f"/api/enrollments/{obj.pk}/id_image/"

        if obj.id_image:
            url = obj.id_image.url
            return request.build_absolute_uri(url) if request else url

        return None


class EnrollmentDetailedSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    section_details = serializers.SerializerMethodField()
    parent_info = ParentInfoSerializer(read_only=True)
    documents = EnrollmentDocumentSerializer(many=True, read_only=True)
    id_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = "__all__"

    def get_section_details(self, obj):
        return {
            "id": obj.section.id if obj.section else None,
            "name": obj.section.name if obj.section else "No Section",
            "grade_level": obj.section.grade_level if obj.section else None,
        }

    def get_id_image_url(self, obj):
        request = self.context.get("request")
        try:
            if obj.id_image and obj.id_image.storage.exists(obj.id_image.name):
                url = obj.id_image.url
                return request.build_absolute_uri(url) if request else url
        except Exception:
            pass

        if getattr(obj, "id_image_data", None):
            if request:
                return request.build_absolute_uri(f"/api/enrollments/{obj.pk}/id_image/")
            return f"/api/enrollments/{obj.pk}/id_image/"

        if obj.id_image:
            url = obj.id_image.url
            return request.build_absolute_uri(url) if request else url

        return None


class OldStudentLookupSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True)
    identifier_type = serializers.ChoiceField(
        choices=["auto", "lrn", "student_number"],
        required=False,
        default="auto",
    )

    def validate_identifier(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Identifier is required.")
        return value


class EnrollmentCreateSerializer(serializers.ModelSerializer):
    parent_info = ParentInfoSerializer(required=False)
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Enrollment
        fields = "__all__"
        extra_kwargs = {
            "student": {"required": False, "allow_null": True},
            "section": {"required": False, "allow_null": True},
            "status": {"required": False},
        }

    def validate(self, attrs):
        is_create = self.instance is None

        def merged_value(field):
            if field in attrs:
                return attrs.get(field)
            if self.instance is not None:
                return getattr(self.instance, field, None)
            return None

        if attrs.get("website"):
            raise serializers.ValidationError("Invalid submission.")

        attrs.pop("website", None)

        if is_create:
            required = [
                "first_name",
                "last_name",
                "education_level",
                "grade_level",
                "student_type",
                "payment_mode",
            ]
            errors = {f: "This field is required." for f in required if not attrs.get(f)}
            if errors:
                raise serializers.ValidationError(errors)

        bd = merged_value("birth_date")
        if bd:
            today = timezone.localdate()

            if bd >= today:
                raise serializers.ValidationError({
                    "birth_date": "Birth date must be in the past."
                })

            age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))

            if age < 3:
                raise serializers.ValidationError({
                    "birth_date": "Student must be at least 3 years old."
                })
            if age > 18:
                raise serializers.ValidationError({
                    "birth_date": "Student age exceeds allowed school range."
                })

        edu = merged_value("education_level")
        grade = merged_value("grade_level")

        if edu == "preschool" and grade and grade not in PRESCHOOL:
            raise serializers.ValidationError({
                "grade_level": "For Preschool, grade must be Pre-Kinder or Kinder."
            })

        if edu == "elementary" and grade and grade not in ELEMENTARY:
            raise serializers.ValidationError({
                "grade_level": "For Elementary, grade must be Grade 1–6."
            })

        contact_fields = {"mobile_number", "telephone_number", "email"}
        contacts_touched = any(f in attrs for f in contact_fields)

        if is_create or contacts_touched:
            mobile = merged_value("mobile_number")
            tel = merged_value("telephone_number")
            email = merged_value("email")

            if not (mobile or tel or email):
                raise serializers.ValidationError({
                    "contact": "Provide at least one contact: mobile number, telephone number, or email."
                })

        if "mobile_number" in attrs and attrs.get("mobile_number"):
            normalized = normalize_ph_mobile(attrs.get("mobile_number"))
            if not normalized:
                raise serializers.ValidationError({
                    "mobile_number": "Invalid PH mobile. Use 09XXXXXXXXX or +639XXXXXXXXX."
                })
            attrs["mobile_number"] = normalized

        tel = attrs.get("telephone_number") if "telephone_number" in attrs else None
        if tel and not PHONE_RE.match(tel):
            raise serializers.ValidationError({
                "telephone_number": "Invalid phone format."
            })

        parent_info = attrs.get("parent_info", None)
        if parent_info is not None:
            has_parent_contact = any([
                parent_info.get("father_contact"),
                parent_info.get("mother_contact"),
                parent_info.get("guardian_contact"),
            ])

            if not has_parent_contact:
                raise serializers.ValidationError({
                    "parent_info": "Provide at least one parent/guardian contact number."
                })

            for field in ["father_contact", "mother_contact", "guardian_contact"]:
                val = parent_info.get(field)
                if val and not PHONE_RE.match(val):
                    raise serializers.ValidationError({
                        "parent_info": {
                            field: "Invalid phone format."
                        }
                    })

        return attrs

    def create(self, validated_data):
        validated_data.pop("website", None)
        parent_data = validated_data.pop("parent_info", None)

        public_user, created = User.objects.get_or_create(
            username="public_user",
            defaults={
                "email": "public@school.com",
                "role": "PARENT_STUDENT",
                "status": "ACTIVE",
                "is_active": True,
            },
        )

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
            validated_data["remarks"] = (
                existing_remarks + " | POSSIBLE DUPLICATE ENROLLMENT"
            ).strip(" |")

        enrollment = super().create(validated_data)

        if parent_data:
            ParentInfo.objects.create(enrollment=enrollment, **parent_data)

        return enrollment

    def update(self, instance, validated_data):
        validated_data.pop("website", None)
        parent_data = validated_data.pop("parent_info", None)

        instance = super().update(instance, validated_data)

        if parent_data is not None:
            ParentInfo.objects.update_or_create(
                enrollment=instance,
                defaults=parent_data
            )

        return instance


class EnrollmentSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnrollmentSettings
        fields = ["open_date", "window_days", "academic_year", "updated_at"]
        read_only_fields = ["updated_at"]