from rest_framework import serializers
from .models import GradeWeight, GradeItem, StudentScore, ClassStanding, AcademicRecord
from accounts.models import Subject
from enrollment.models import Enrollment


def format_grade_level(value):
    if value is None:
        return "—"

    normalized = str(value).strip().lower().replace(" ", "").replace("-", "")

    if normalized in {"prek", "prekinder", "prekindergarten"}:
        return "Pre Kinder"
    if normalized in {"kinder", "kindergarten", "0"}:
        return "Kinder"
    if normalized.startswith("grade"):
        suffix = normalized.replace("grade", "")
        return f"Grade {suffix}" if suffix.isdigit() else str(value).strip() or "—"
    if normalized.isdigit() and int(normalized) > 0:
        return f"Grade {int(normalized)}"

    return str(value).strip() or "—"


def resolve_student_display_name(user, school_year=None):
    if not user:
        return "—"

    try:
        profile = getattr(user, "profile", None)
        if profile:
            profile_name = f"{profile.student_first_name} {profile.student_last_name}".strip()
            if profile_name:
                return profile_name
    except Exception:
        pass

    enrollment_qs = Enrollment.objects.filter(student=user)
    if school_year:
        enrollment_qs = enrollment_qs.filter(academic_year=school_year)

    enrollment = enrollment_qs.order_by("-created_at", "-id").first()
    if enrollment:
        enrollment_name = f"{enrollment.first_name or ''} {enrollment.last_name or ''}".strip()
        if enrollment_name:
            return enrollment_name

    user_full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    if user_full_name:
        return user_full_name

    return getattr(user, "username", None) or "—"


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
        return format_grade_level(value) if value is not None else ""


# ─── Academic Record (historical) ───
class AcademicRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)
    student_display_name = serializers.SerializerMethodField(read_only=True)
    student_username = serializers.CharField(source="student.username", read_only=True)
    student_number = serializers.SerializerMethodField(read_only=True)
    recorded_by_name = serializers.SerializerMethodField(read_only=True)
    grade_level_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AcademicRecord
        fields = [
            "id", "student", "student_name", "student_display_name", "student_username", "student_number",
            "school_year", "grade_level", "section_name",
            "grade_level_label",
            "subject_name", "subject_code",
            "q1", "q2", "q3", "q4", "final_grade",
            "remarks", "teacher_name",
            "recorded_by", "recorded_by_name",
            "created_at", "updated_at",
        ]
        read_only_fields = ["recorded_by", "created_at", "updated_at"]

    def get_student_name(self, obj):
        return self.get_student_display_name(obj)

    def get_student_display_name(self, obj):
        stored_name = str(getattr(obj, "student_name", "") or "").strip()
        if stored_name:
            return stored_name
        return resolve_student_display_name(obj.student, getattr(obj, "school_year", None))

    def get_student_number(self, obj):
        stored_number = str(getattr(obj, "student_number", "") or "").strip()
        if stored_number:
            return stored_number
        try:
            return obj.student.profile.student_number or None
        except Exception:
            return None

    def create(self, validated_data):
        student = validated_data.get("student")
        school_year = validated_data.get("school_year")
        if student and not validated_data.get("student_name"):
            validated_data["student_name"] = resolve_student_display_name(student, school_year)
        if student and not validated_data.get("student_number"):
            try:
                validated_data["student_number"] = student.profile.student_number or ""
            except Exception:
                validated_data["student_number"] = ""
        return super().create(validated_data)

    def update(self, instance, validated_data):
        student = validated_data.get("student", getattr(instance, "student", None))
        school_year = validated_data.get("school_year", getattr(instance, "school_year", None))
        if student and not validated_data.get("student_name"):
            validated_data["student_name"] = resolve_student_display_name(student, school_year)
        if student and not validated_data.get("student_number"):
            try:
                validated_data["student_number"] = student.profile.student_number or ""
            except Exception:
                validated_data["student_number"] = getattr(instance, "student_number", "") or ""
        return super().update(instance, validated_data)

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return None
        return getattr(obj.recorded_by, "username", None) or str(obj.recorded_by_id)

    def get_grade_level_label(self, obj):
        return format_grade_level(getattr(obj, "grade_level", None))
