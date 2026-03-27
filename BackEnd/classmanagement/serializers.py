from rest_framework import serializers
from accounts.models import User
from .models import Schedule, Room, SchoolYear


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ["id", "code", "name", "capacity", "is_active"]


class SchoolYearSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()

    class Meta:
        model = SchoolYear
        fields = ["id", "name", "start_date", "end_date", "is_active", "created_at", "status"]

    def get_status(self, obj):
        return obj.status


class ScheduleReadSerializer(serializers.ModelSerializer):
    """Read-only schedule with nested human-readable names."""
    teacher_name = serializers.CharField(source="teacher.username", read_only=True)
    subject_name = serializers.SerializerMethodField()
    subject_code = serializers.CharField(source="subject.code", read_only=True, allow_null=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    grade_level = serializers.CharField(source="section.grade_level_display", read_only=True)
    room_code = serializers.SerializerMethodField()
    room_name = serializers.SerializerMethodField()
    section_room_code = serializers.SerializerMethodField()
    section_room_name = serializers.SerializerMethodField()
    school_year_name = serializers.CharField(source="school_year.name", read_only=True, allow_null=True)

    class Meta:
        model = Schedule
        fields = [
            "id", "teacher", "teacher_name",
            "subject", "subject_name", "subject_code",
            "section", "section_name", "grade_level",
            "day_of_week", "start_time", "end_time",
            "room", "room_code", "room_name", "section_room_code", "section_room_name",
            "school_year", "school_year_name",
        ]

    def get_subject_name(self, obj):
        if obj.subject:
            return obj.subject.name
        return "Free Period"  # Fallback for non-subject entries

    def get_room_code(self, obj):
        if obj.room:
            return obj.room.code
        if obj.section and obj.section.room:
            return obj.section.room.code
        return None

    def get_room_name(self, obj):
        if obj.room:
            return obj.room.name
        if obj.section and obj.section.room:
            return obj.section.room.name
        return None

    def get_section_room_code(self, obj):
        if obj.section and obj.section.room:
            return obj.section.room.code
        return None

    def get_section_room_name(self, obj):
        if obj.section and obj.section.room:
            return obj.section.room.name
        return None


class ScheduleWriteSerializer(serializers.ModelSerializer):
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role="TEACHER"),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Schedule
        fields = [
            "id", "teacher", "subject", "section",
            "day_of_week", "start_time", "end_time", "room", "school_year",
        ]

    def validate(self, data):
        start = data.get("start_time") or (self.instance and self.instance.start_time)
        end = data.get("end_time") or (self.instance and self.instance.end_time)
        if start and end and start >= end:
            raise serializers.ValidationError("end_time must be after start_time")
        return data
