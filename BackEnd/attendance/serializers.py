from rest_framework import serializers
from .models import AttendanceRecord
from accounts.models import Section


class AttendanceRecordSerializer(serializers.ModelSerializer):
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

    def get_student_name(self, obj):
        if hasattr(obj.student, "profile") and obj.student.profile:
            p = obj.student.profile
            if p.student_first_name and p.student_last_name:
                return f"{p.student_first_name} {p.student_last_name}"
        return obj.student.username

    def get_student_number(self, obj):
        if hasattr(obj.student, "profile") and obj.student.profile:
            return obj.student.profile.lrn or None
        return None

    def get_subject_name(self, obj):
        if obj.subject:
            return obj.subject.name
        if obj.schedule and obj.schedule.subject:
            return obj.schedule.subject.name
        return None

    def get_grade_level(self, obj):
        gl = getattr(obj.section, "grade_level", None)
        if gl == 0:
            return "Kinder"
        if gl is not None:
            return f"Grade {gl}"
        return "—"

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


class BulkAttendanceSerializer(serializers.Serializer):
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
            if "student_id" not in record:
                raise serializers.ValidationError("Each record must have a student_id")
            if "status" not in record:
                raise serializers.ValidationError("Each record must have a status")
            if record["status"] not in ["PRESENT", "ABSENT", "LATE", "EXCUSED"]:
                raise serializers.ValidationError(f"Invalid status: {record['status']}")
        return data


class SectionSimpleSerializer(serializers.ModelSerializer):
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


class StudentAttendanceStatsSerializer(serializers.Serializer):
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
