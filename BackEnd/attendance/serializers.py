from rest_framework import serializers
from CESI.serializer_safety import SafeSerializer, SafeModelSerializer
from django.db.models import Q
import re
from .models import AttendanceRecord
from accounts.models import Section
from enrollment.models import Enrollment


def _normalize_grade_level(value):
    if value is None or value == "":
        return None

    normalized = str(value).strip().lower().replace("_", " ").replace("-", " ")
    normalized = " ".join(normalized.split())

    if any(token in normalized for token in ["pre kinder", "pre k", "prek", "prekindergarten"]):
        return -1

    if "kinder" in normalized:
        return 0

    match = re.search(r"(?:grade\s*)?(\d)", normalized)
    if match:
                grade_number = int(match.group(1))
                if 1 <= grade_number <= 6:
          return grade_number

    try:
        numeric = int(normalized)
    except (TypeError, ValueError):
        return None

    return numeric if 0 <= numeric <= 6 else None


def _format_grade_level(value):
    normalized = _normalize_grade_level(value)
    if normalized == -1:
        return "Pre Kinder"
    if normalized == 0:
        return "Kinder"
    if normalized is not None:
        return f"Grade {normalized}"
    return str(value).strip() if value is not None else None


class AttendanceRecordSerializer(SafeModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_username = serializers.CharField(source="student.username", read_only=True)
    student_number = serializers.SerializerMethodField()
    section_name = serializers.CharField(source="section.name", read_only=True)
    grade_level = serializers.SerializerMethodField()
    marked_by_name = serializers.CharField(source="marked_by.username", read_only=True)
    subject_name = serializers.SerializerMethodField()
    subject_code = serializers.SerializerMethodField()
    schedule_time = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "student",
            "student_name",
            "student_username",
            "student_number",
            "section",
            "section_name",
            "grade_level",
            "schedule",
            "subject",
            "subject_name",
            "subject_code",
            "schedule_time",
            "date",
            "status",
            "marked_by",
            "marked_by_name",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "marked_by"]

    def _get_active_enrollment_snapshot(self, student_id):
        if not hasattr(self, "_enrollment_cache"):
            self._enrollment_cache = {}

        if student_id in self._enrollment_cache:
            return self._enrollment_cache[student_id]

        enrollment = (
            Enrollment.objects.filter(status="ACTIVE")
            .filter(Q(parent_user_id=student_id) | Q(student_id=student_id))
            .only("first_name", "last_name", "student_number", "lrn", "updated_at")
            .order_by("-updated_at", "-id")
            .first()
        )

        self._enrollment_cache[student_id] = enrollment
        return enrollment

    def get_student_name(self, obj):
        if hasattr(obj.student, "profile") and obj.student.profile:
            p = obj.student.profile
            if p.student_first_name and p.student_last_name:
                return f"{p.student_first_name} {p.student_last_name}"

        enrollment = self._get_active_enrollment_snapshot(obj.student_id)
        if enrollment:
            first_name = (enrollment.first_name or "").strip()
            last_name = (enrollment.last_name or "").strip()
            full_name = f"{first_name} {last_name}".strip()
            if full_name:
                return full_name

        user_first_name = (obj.student.first_name or "").strip()
        user_last_name = (obj.student.last_name or "").strip()
        user_full_name = f"{user_first_name} {user_last_name}".strip()
        if user_full_name:
            return user_full_name

        return obj.student.username

    def get_student_number(self, obj):
        if hasattr(obj.student, "profile") and obj.student.profile:
            profile_number = obj.student.profile.student_number or obj.student.profile.lrn
            if profile_number:
                return profile_number

        enrollment = self._get_active_enrollment_snapshot(obj.student_id)
        if enrollment:
            return enrollment.student_number or enrollment.lrn or None

        return None

    def get_subject_name(self, obj):
        if obj.subject:
            return obj.subject.name
        if obj.schedule and obj.schedule.subject:
            return obj.schedule.subject.name
        return None

    def get_grade_level(self, obj):
        gl = getattr(obj.section, "grade_level", None)
        return _format_grade_level(gl) or "—"

    def get_subject_code(self, obj):
        if obj.subject:
            return obj.subject.code
        if obj.schedule and obj.schedule.subject:
            return obj.schedule.subject.code
        return None

    def get_schedule_time(self, obj):
        if obj.schedule:
            return f"{obj.schedule.start_time.strftime('%H:%M')} - {obj.schedule.end_time.strftime('%H:%M')}"
        return None


class BulkAttendanceSerializer(SafeSerializer):
    """
    For bulk creating/updating attendance records.
    Now supports per-subject attendance with optional schedule field.
    """
    section = serializers.IntegerField()
    date = serializers.DateField()
    schedule = serializers.IntegerField(required=False, allow_null=True)
    subject = serializers.IntegerField(required=False, allow_null=True)
    records = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField(allow_blank=True),
        )
    )

    def validate_records(self, data):
        for record in data:
            student_id = record.get("student_id")
            student_number = (record.get("student_number") or "").strip()
            if not student_number and student_id in [None, "", "null"]:
                raise serializers.ValidationError(
                    "Each record must include student_number or student_id"
                )
            if "status" not in record:
                raise serializers.ValidationError("Each record must have a status")
            if record["status"] not in ["PRESENT", "ABSENT", "LATE", "EXCUSED"]:
                raise serializers.ValidationError(f"Invalid status: {record['status']}")
        return data


class SectionSimpleSerializer(SafeModelSerializer):
    """Simple serializer for sections the teacher teaches."""
    grade_level = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = ["id", "name", "grade_level"]

    def get_grade_level(self, obj):
        """Convert grade_level integer to readable name."""
        gl = obj.grade_level
        if gl == 0:
            return "Kinder"
        return f"Grade {gl}"


class StudentAttendanceStatsSerializer(SafeSerializer):
    """For returning attendance statistics."""
    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    total = serializers.IntegerField()
    present = serializers.IntegerField()
    absent = serializers.IntegerField()
    late = serializers.IntegerField()
    excused = serializers.IntegerField()
    attended = serializers.IntegerField()
    percentage = serializers.FloatField(allow_null=True)
