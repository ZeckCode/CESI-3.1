from rest_framework import serializers
from .models import GradeWeight, GradeItem, StudentScore, ClassStanding, AcademicRecord
from accounts.models import Subject


# ─── Weight Config ───
class GradeWeightSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)

    class Meta:
        model = GradeWeight
        fields = [
            "id", "subject", "subject_name", "subject_code",
            "activity_weight", "quiz_weight", "exam_weight",
            "class_standing_weight",
        ]


# ─── Grade Items (Activity / Quiz / Exam) ───
class GradeItemSerializer(serializers.ModelSerializer):
    date_given = serializers.DateField(format="%Y-%m-%d", required=False, allow_null=True)
    due_date = serializers.DateField(format="%Y-%m-%d", required=False, allow_null=True)

    class Meta:
        model = GradeItem
        fields = [
            "id", "teacher", "subject", "grade_level", "quarter",
            "category", "title", "description",
            "date_given", "due_date", "total_score", "order",
            "created_at",
        ]
        read_only_fields = ["teacher", "created_at"]


# ─── Student Scores ───
class StudentScoreSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    grade_item_title = serializers.CharField(source="grade_item.title", read_only=True)
    total_score = serializers.IntegerField(source="grade_item.total_score", read_only=True)

    class Meta:
        model = StudentScore
        fields = [
            "id", "student", "student_name", "grade_item",
            "grade_item_title", "score", "total_score",
        ]

    def get_student_name(self, obj):
        try:
            p = obj.student.profile
            return f"{p.student_first_name} {p.student_last_name}"
        except Exception:
            return obj.student.username


# ─── Class Standing ───
class ClassStandingSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = ClassStanding
        fields = ["id", "student", "student_name", "subject", "quarter", "score"]

    def get_student_name(self, obj):
        try:
            p = obj.student.profile
            return f"{p.student_first_name} {p.student_last_name}"
        except Exception:
            return obj.student.username


# ─── Lightweight student list serializer ───
class StudentListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    student_name = serializers.CharField()
    grade_level = serializers.SerializerMethodField()

    def get_grade_level(self, obj):
        value = obj.get("grade_level") if isinstance(obj, dict) else getattr(obj, "grade_level", None)
        if value is None:
            return ""

        value = str(value).strip().lower()

        if value.startswith("grade"):
            num = value.replace("grade", "")
            return f"Grade {num}" if num.isdigit() else value

        return f"Grade {value}" if value.isdigit() else value


# ─── Academic Record (historical) ───
class AcademicRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)
    student_username = serializers.CharField(source="student.username", read_only=True)
    student_number = serializers.SerializerMethodField(read_only=True)
    recorded_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AcademicRecord
        fields = [
            "id", "student", "student_name", "student_username", "student_number",
            "school_year", "grade_level", "section_name",
            "subject_name", "subject_code",
            "q1", "q2", "q3", "q4", "final_grade",
            "remarks", "teacher_name",
            "recorded_by", "recorded_by_name",
            "created_at", "updated_at",
        ]
        read_only_fields = ["recorded_by", "created_at", "updated_at"]

    def get_student_name(self, obj):
        try:
            profile = obj.student.profile
            full_name = f"{profile.student_first_name} {profile.student_last_name}".strip()
            return full_name or obj.student.username
        except Exception:
            return obj.student.username

    def get_student_number(self, obj):
        try:
            return obj.student.profile.student_number or None
        except Exception:
            return None

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return None
        return getattr(obj.recorded_by, "username", None) or str(obj.recorded_by_id)
