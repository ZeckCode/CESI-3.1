from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from django.db.models import Count, Max, Q, Sum

from decimal import Decimal

from .models import GradeWeight, GradeItem, StudentScore, ClassStanding, AcademicRecord
from .serializers import (
    GradeWeightSerializer,
    GradeItemSerializer,
    StudentScoreSerializer,
    ClassStandingSerializer,
    AcademicRecordSerializer,
)
from accounts.models import User, UserProfile, Subject
from classmanagement.models import Schedule
from enrollment.models import Enrollment

from finance.models import Transaction


def normalize_grade_level(value):
    if value is None:
        return None

    normalized = str(value).strip().lower()

    grade_map = {
        "prek": -1,
        "pre-kinder": -1,
        "kinder": 0,
        "grade1": 1,
        "grade2": 2,
        "grade3": 3,
        "grade4": 4,
        "grade5": 5,
        "grade6": 6,
        "grade 1": 1,
        "grade 2": 2,
        "grade 3": 3,
        "grade 4": 4,
        "grade 5": 5,
        "grade 6": 6,
        "0": 0,
        "1": 1,
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
    }

    if normalized in grade_map:
        return grade_map[normalized]

    try:
        return int(normalized)
    except (ValueError, TypeError):
        return None


def grade_level_label(value):
    normalized = normalize_grade_level(value)
    if normalized == -1:
        return "Pre-Kinder"
    if normalized == 0:
        return "Kinder"
    if normalized is not None and normalized > 0:
        return f"Grade {normalized}"
    return str(value or "—")


# ══════════════════════════════════════════════════════
# WEIGHTS  —  get / update per subject
# ══════════════════════════════════════════════════════
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_weights(request, subject_id):
    """Return weights for a subject. Auto-creates defaults if missing."""
    try:
        subject = Subject.objects.get(pk=subject_id)
    except Subject.DoesNotExist:
        return Response({"detail": "Subject not found"}, status=404)
    weight, _ = GradeWeight.objects.get_or_create(subject=subject)
    return Response(GradeWeightSerializer(weight).data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_weights(request, subject_id):
    """Teacher updates the weight percentages."""
    if getattr(request.user, "role", None) != "TEACHER":
        return Response({"detail": "Forbidden"}, status=403)
    try:
        subject = Subject.objects.get(pk=subject_id)
    except Subject.DoesNotExist:
        return Response({"detail": "Subject not found"}, status=404)
    weight, _ = GradeWeight.objects.get_or_create(subject=subject)
    ser = GradeWeightSerializer(weight, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data)


# ══════════════════════════════════════════════════════
# GRADE ITEMS  —  CRUD
# ══════════════════════════════════════════════════════
class GradeItemListCreate(generics.ListCreateAPIView):
    serializer_class = GradeItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = GradeItem.objects.all()
        subject = self.request.query_params.get("subject")
        grade_level = self.request.query_params.get("grade_level")
        quarter = self.request.query_params.get("quarter")
        category = self.request.query_params.get("category")

        if subject:
            qs = qs.filter(subject_id=subject)

        if grade_level is not None and grade_level != "":
            mapped_grade = normalize_grade_level(grade_level)
            if mapped_grade is None:
                raise ValidationError({"grade_level": f"Invalid grade_level: {grade_level}"})
            qs = qs.filter(grade_level=mapped_grade)

        if quarter:
            qs = qs.filter(quarter=quarter)

        if category:
            qs = qs.filter(category=category.upper())

        return qs

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)


class GradeItemDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = GradeItem.objects.all()
    serializer_class = GradeItemSerializer
    permission_classes = [IsAuthenticated]


# ══════════════════════════════════════════════════════
# STUDENT SCORES  —  CRUD + bulk upsert
# ══════════════════════════════════════════════════════
class StudentScoreListCreate(generics.ListCreateAPIView):
    serializer_class = StudentScoreSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = StudentScore.objects.select_related("student", "grade_item").all()
        grade_item = self.request.query_params.get("grade_item")
        student = self.request.query_params.get("student")
        subject = self.request.query_params.get("subject")
        grade_level = self.request.query_params.get("grade_level")
        quarter = self.request.query_params.get("quarter")

        if grade_item:
            qs = qs.filter(grade_item_id=grade_item)

        if student:
            qs = qs.filter(student_id=student)

        if subject:
            qs = qs.filter(grade_item__subject_id=subject)

        if grade_level is not None and grade_level != "":
            mapped_grade = normalize_grade_level(grade_level)
            if mapped_grade is None:
                raise ValidationError({"grade_level": f"Invalid grade_level: {grade_level}"})
            qs = qs.filter(grade_item__grade_level=mapped_grade)

        if quarter:
            qs = qs.filter(grade_item__quarter=quarter)

        return qs


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upsert_score(request):
    """
    Create or update a single score.
    Body: { student, grade_item, score }
    """
    student_id = request.data.get("student")
    grade_item_id = request.data.get("grade_item")
    score_val = request.data.get("score")

    if not all([student_id, grade_item_id, score_val is not None]):
        return Response({"detail": "student, grade_item, score required"}, status=400)

    try:
        grade_item = GradeItem.objects.get(pk=grade_item_id)
    except GradeItem.DoesNotExist:
        return Response({"detail": "Grade item not found"}, status=404)

    obj, created = StudentScore.objects.update_or_create(
        student_id=student_id,
        grade_item=grade_item,
        defaults={"score": score_val},
    )
    return Response(StudentScoreSerializer(obj).data, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════
# CLASS STANDING  —  upsert
# ══════════════════════════════════════════════════════
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upsert_class_standing(request):
    """
    Create or update class standing.
    Body: { student, subject, quarter, score }
    """
    student_id = request.data.get("student")
    subject_id = request.data.get("subject")
    quarter = request.data.get("quarter")
    score_val = request.data.get("score")

    if not all([student_id, subject_id, quarter, score_val is not None]):
        return Response({"detail": "student, subject, quarter, score required"}, status=400)

    obj, _ = ClassStanding.objects.update_or_create(
        student_id=student_id,
        subject_id=subject_id,
        quarter=quarter,
        defaults={"score": score_val},
    )
    return Response(ClassStandingSerializer(obj).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_class_standings(request):
    qs = ClassStanding.objects.all()
    subject = request.query_params.get("subject")
    quarter = request.query_params.get("quarter")
    student = request.query_params.get("student")
    if subject:
        qs = qs.filter(subject_id=subject)
    if quarter:
        qs = qs.filter(quarter=quarter)
    if student:
        qs = qs.filter(student_id=student)
    return Response(ClassStandingSerializer(qs, many=True).data)


# ══════════════════════════════════════════════════════
# STUDENTS LIST  —  by grade level
# ══════════════════════════════════════════════════════
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def students_by_grade(request, grade_level):
    """Return students enrolled in a given grade level."""
    profiles = UserProfile.objects.filter(
        grade_level=grade_level,
        user__role="PARENT_STUDENT",
    ).select_related("user")
    result = []
    for p in profiles:
        result.append({
            "id": p.user.id,
            "username": p.user.username,
            "student_name": f"{p.student_first_name} {p.student_last_name}",
            "grade_level": p.grade_level,
        })
    return Response(result)


# ══════════════════════════════════════════════════════
# COMPUTE QUARTER GRADE  (live computation)
# ══════════════════════════════════════════════════════
def _compute_quarter_grade(student_id, subject_id, quarter):
    """
    Compute the weighted quarter grade for one student.
    Returns dict with category averages + weighted total.
    """
    try:
        w = GradeWeight.objects.get(subject_id=subject_id)
    except GradeWeight.DoesNotExist:
        w = None
    aw = w.activity_weight if w else 40
    qw = w.quiz_weight if w else 20
    ew = w.exam_weight if w else 20
    cw = w.class_standing_weight if w else 20

    def _avg(category):
        items = GradeItem.objects.filter(
            subject_id=subject_id, quarter=quarter, category=category
        )
        if not items.exists():
            return None
        scores = StudentScore.objects.filter(
            student_id=student_id, grade_item__in=items
        )
        if not scores.exists():
            return None
        total_earned = sum(s.score for s in scores)
        total_possible = sum(s.grade_item.total_score for s in scores.select_related("grade_item"))
        if total_possible == 0:
            return Decimal("0")
        return (Decimal(str(total_earned)) / Decimal(str(total_possible))) * 100

    act_avg = _avg("ACTIVITY")
    quiz_avg = _avg("QUIZ")
    exam_avg = _avg("EXAM")

    try:
        cs = ClassStanding.objects.get(
            student_id=student_id, subject_id=subject_id, quarter=quarter
        )
        cs_score = cs.score
    except ClassStanding.DoesNotExist:
        cs_score = None

    components = []
    if act_avg is not None:
        components.append((act_avg, aw))
    if quiz_avg is not None:
        components.append((quiz_avg, qw))
    if exam_avg is not None:
        components.append((exam_avg, ew))
    if cs_score is not None:
        components.append((Decimal(str(cs_score)), cw))

    if not components:
        weighted_total = None
    else:
        total_weight = sum(c[1] for c in components)
        if total_weight > 0:
            weighted_total = sum(val * wt for val, wt in components) / Decimal(str(total_weight)) * 100 / 100
        else:
            weighted_total = None

    return {
        "activity_avg": round(float(act_avg), 2) if act_avg is not None else None,
        "quiz_avg": round(float(quiz_avg), 2) if quiz_avg is not None else None,
        "exam_avg": round(float(exam_avg), 2) if exam_avg is not None else None,
        "class_standing": round(float(cs_score), 2) if cs_score is not None else None,
        "quarter_grade": round(float(weighted_total), 2) if weighted_total is not None else None,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_quarter_grades(request, student_id, subject_id):
    """
    Return computed grades for all 4 quarters + final average for one student.
    Used by both teacher and parent views.
    """
    quarters = {}
    final_parts = []
    for q in range(1, 5):
        data = _compute_quarter_grade(student_id, subject_id, q)
        quarters[f"q{q}"] = data
        if data["quarter_grade"] is not None:
            final_parts.append(data["quarter_grade"])

    final_grade = round(sum(final_parts) / len(final_parts), 2) if final_parts else None

    return Response({
        "student_id": student_id,
        "subject_id": subject_id,
        "quarters": quarters,
        "final_grade": final_grade,
        "remarks": "PASSED" if final_grade and final_grade >= 75 else ("FAILED" if final_grade else None),
    })


# ══════════════════════════════════════════════════════
# PARENT  —  my child's report card
# ══════════════════════════════════════════════════════
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_grades(request):
    """
    Parent sees their child's grades across ALL subjects.
    Returns a card-style payload: per subject → per quarter final + overall.
    """
    user = request.user
    if user.role != "PARENT_STUDENT":
        return Response({"detail": "Forbidden"}, status=403)

    subjects = Subject.objects.all()
    result = []
    for subj in subjects:
        quarters = {}
        parts = []
        for q in range(1, 5):
            data = _compute_quarter_grade(user.id, subj.id, q)
            quarters[f"q{q}"] = data["quarter_grade"]
            if data["quarter_grade"] is not None:
                parts.append(data["quarter_grade"])
        final = round(sum(parts) / len(parts), 2) if parts else None
        result.append({
            "subject_id": subj.id,
            "subject_name": subj.name,
            "subject_code": subj.code,
            "q1": quarters["q1"],
            "q2": quarters["q2"],
            "q3": quarters["q3"],
            "q4": quarters["q4"],
            "final_grade": final,
            "remarks": "PASSED" if final and final >= 75 else ("FAILED" if final else None),
        })
    return Response(result)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_grade_records_monitoring(request):
    """
    Admin monitoring payload for current grades + academic history counts.
    Query params: quarter=<1-4>
    """
    user = request.user
    if user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    quarter_param = request.query_params.get("quarter", "1")
    try:
        quarter = int(quarter_param)
        if quarter not in (1, 2, 3, 4):
            raise ValueError()
    except (TypeError, ValueError):
        return Response({"detail": "Invalid quarter"}, status=400)

    subjects = list(Subject.objects.all().order_by("name"))
    history_by_student = {
        row["student_id"]: row
        for row in AcademicRecord.objects.values("student_id").annotate(
            record_count=Count("id"),
            latest_school_year=Max("school_year"),
        )
    }

    enrollments = (
        Enrollment.objects.filter(status="ACTIVE")
        .select_related("student", "student__profile", "section")
        .order_by("grade_level", "section__name", "last_name", "first_name")
    )

    students = []
    student_averages = []
    completed_count = 0

    for enrollment in enrollments:
        student = enrollment.student
        if not student:
            continue

        name = " ".join(
            part for part in [enrollment.first_name or "", enrollment.last_name or ""] if part
        ).strip()
        if not name and hasattr(student, "profile") and student.profile:
            name = " ".join(
                part for part in [student.profile.student_first_name or "", student.profile.student_last_name or ""] if part
            ).strip()
        name = name or student.username

        section_grade = getattr(enrollment.section, "grade_level", None)
        normalized_grade = normalize_grade_level(section_grade if section_grade is not None else enrollment.grade_level)
        subject_breakdown = []
        graded_values = []

        for subject in subjects:
            grade_data = _compute_quarter_grade(student.id, subject.id, quarter)
            quarter_grade = grade_data["quarter_grade"]
            if quarter_grade is not None:
                graded_values.append(quarter_grade)
            subject_breakdown.append({
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "quarter_grade": quarter_grade,
                "remarks": (
                    "PASSED" if quarter_grade is not None and quarter_grade >= 75
                    else "FAILED" if quarter_grade is not None
                    else None
                ),
            })

        average_grade = round(sum(graded_values) / len(graded_values), 2) if graded_values else None
        total_subjects = len(subjects)
        graded_subjects = len(graded_values)

        if total_subjects > 0 and graded_subjects == total_subjects:
            status_label = "completed"
            completed_count += 1
        elif graded_subjects > 0:
            status_label = "partial"
        else:
            status_label = "pending"

        if average_grade is not None:
            student_averages.append(average_grade)

        history_meta = history_by_student.get(student.id, {})
        students.append({
            "student_id": student.id,
            "student_username": student.username,
            "student_number": enrollment.student_number or getattr(getattr(student, "profile", None), "student_number", None),
            "student_name": name,
            "grade_level": normalized_grade,
            "grade_level_label": grade_level_label(normalized_grade),
            "section_name": enrollment.section.name if enrollment.section else "—",
            "graded_subjects": graded_subjects,
            "total_subjects": total_subjects,
            "average_grade": average_grade,
            "status": status_label,
            "history_count": history_meta.get("record_count", 0),
            "latest_history_year": history_meta.get("latest_school_year"),
            "subject_breakdown": subject_breakdown,
        })

    students.sort(key=lambda row: (
        row["grade_level"] if row["grade_level"] is not None else 999,
        row["section_name"],
        row["student_name"].lower(),
    ))

    return Response({
        "quarter": quarter,
        "summary": {
            "total_students": len(students),
            "graded_students": len(student_averages),
            "pending_grades": len([row for row in students if row["status"] != "completed"]),
            "completed_students": completed_count,
            "average_grade": round(sum(student_averages) / len(student_averages), 2) if student_averages else None,
            "students_with_history": len([row for row in students if row["history_count"] > 0]),
            "academic_record_count": sum(row["history_count"] for row in students),
        },
        "students": students,
    })


# ══════════════════════════════════════════════════════
# TEACHER  —  subject info for logged-in teacher
# ══════════════════════════════════════════════════════
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_info(request):
    """Return the teacher's assigned subject."""
    user = request.user
    if user.role != "TEACHER":
        return Response({"detail": "Forbidden"}, status=403)
    try:
        tp = user.teacher_profile
        if tp.subject:
            return Response({
                "subject_id": tp.subject.id,
                "subject_name": tp.subject.name,
                "subject_code": tp.subject.code,
            })
        return Response({"detail": "No subject assigned"}, status=404)
    except Exception:
        return Response({"detail": "Teacher profile not found"}, status=404)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def section_performance(request):
    """
    Bulk compute quarter grades + attendance for every active student in a section.
    Query params: section=<id>, quarter=<1-4>
    The teacher's subject is resolved from their profile.
    """
    user = request.user
    if user.role not in ("TEACHER", "ADMIN"):
        return Response({"detail": "Forbidden"}, status=403)

    section_id = request.query_params.get("section")
    quarter_param = request.query_params.get("quarter")

    if not section_id or not quarter_param:
        return Response({"detail": "section and quarter are required"}, status=400)

    try:
        section_id = int(section_id)
        quarter = int(quarter_param)
        if quarter not in (1, 2, 3, 4):
            raise ValueError()
    except (ValueError, TypeError):
        return Response({"detail": "Invalid section or quarter"}, status=400)

    if user.role == "TEACHER":
        try:
            subject_id = user.teacher_profile.subject_id
        except Exception:
            return Response({"detail": "Teacher profile not found"}, status=404)
        if not subject_id:
            return Response({"detail": "No subject assigned to this teacher"}, status=404)
        teacher_schedules = Schedule.objects.filter(
            teacher=user,
            section_id=section_id,
            subject_id=subject_id,
        )
        if not teacher_schedules.exists():
            return Response({"detail": "Forbidden"}, status=403)
        schedule_ids = list(teacher_schedules.values_list("id", flat=True))
    else:
        raw_subj = request.query_params.get("subject")
        if not raw_subj:
            return Response({"detail": "subject param required for admin"}, status=400)
        try:
            subject_id = int(raw_subj)
        except (ValueError, TypeError):
            return Response({"detail": "Invalid subject id"}, status=400)
        schedule_ids = list(
            Schedule.objects.filter(section_id=section_id, subject_id=subject_id)
            .values_list("id", flat=True)
        )

    from datetime import date as date_class
    from attendance.models import AttendanceRecord

    today = date_class.today()
    sy_start = today.year if today.month >= 6 else today.year - 1
    quarter_ranges = {
        1: (date_class(sy_start, 6, 1), date_class(sy_start, 8, 31)),
        2: (date_class(sy_start, 9, 1), date_class(sy_start, 11, 30)),
        3: (date_class(sy_start, 12, 1), date_class(sy_start + 1, 2, 28)),
        4: (date_class(sy_start + 1, 3, 1), date_class(sy_start + 1, 5, 31)),
    }
    q_start, q_end = quarter_ranges[quarter]

    students_map = {}
    enrollments = (
        Enrollment.objects.filter(section_id=section_id, status="ACTIVE")
        .select_related("student", "student__profile")
        .order_by("last_name", "first_name")
    )
    for enr in enrollments:
        stu = enr.student
        if not stu:
            continue
        name = " ".join(p for p in [enr.first_name or "", enr.last_name or ""] if p).strip()
        if not name and hasattr(stu, "profile") and stu.profile:
            name = " ".join(
                p for p in [stu.profile.student_first_name or "", stu.profile.student_last_name or ""] if p
            ).strip()
        students_map[stu.id] = name or stu.username

    for p in UserProfile.objects.filter(
        section_id=section_id,
        user__role="PARENT_STUDENT",
        user__status="ACTIVE",
    ).select_related("user"):
        if p.user_id not in students_map:
            students_map[p.user_id] = " ".join(
                pt for pt in [p.student_first_name or "", p.student_last_name or ""] if pt
            ).strip() or p.user.username

    results = []
    for student_id, student_name in students_map.items():
        grade_data = _compute_quarter_grade(student_id, subject_id, quarter)
        att = AttendanceRecord.get_student_attendance_stats(
            student_id,
            q_start,
            q_end,
            schedule_ids=schedule_ids,
            section_id=section_id,
        )
        if att["percentage"] is None:
            # Fall back to legacy section-level attendance records when subject-linked rows do not exist.
            att = AttendanceRecord.get_student_attendance_stats(
                student_id,
                q_start,
                q_end,
                section_id=section_id,
            )
        results.append({
            "student_id": student_id,
            "student_name": student_name,
            "quarter_grade": grade_data["quarter_grade"],
            "activity_avg": grade_data["activity_avg"],
            "quiz_avg": grade_data["quiz_avg"],
            "exam_avg": grade_data["exam_avg"],
            "class_standing": grade_data["class_standing"],
            "attendance_pct": att["percentage"],
            "attendance_days_present": att["present"],
            "attendance_days_absent": att["absent"],
            "attendance_days_total": att["total"],
        })

    results.sort(
        key=lambda x: x["quarter_grade"] if x["quarter_grade"] is not None else -1,
        reverse=True,
    )
    return Response(results)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_sections(request):
    """
    Return sections from Class Management schedules for the logged-in teacher.
    Optional query param: ?subject=<subject_id>
    """
    user = request.user
    if user.role != "TEACHER":
        return Response({"detail": "Forbidden"}, status=403)

    subject_id = request.query_params.get("subject")
    qs = Schedule.objects.select_related("section", "subject").filter(teacher=user)
    if subject_id:
        qs = qs.filter(subject_id=subject_id)

    sections_map = {}
    for sched in qs:
        sec = sched.section
        if not sec:
            continue
        if sec.id not in sections_map:
            sections_map[sec.id] = {
                "id": sec.id,
                "name": sec.name,
                "grade_level": sec.grade_level,
                "subject_id": sched.subject_id,
                "subject_name": sched.subject.name if sched.subject else None,
            }

    result = sorted(
        sections_map.values(),
        key=lambda s: (s["grade_level"], s["name"]),
    )
    return Response(result)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def students_by_section(request, section_id):
    """
    Return students for one section using active enrollments as source of truth,
    with profile-section fallback for legacy records.
    """
    user = request.user
    if user.role not in ("TEACHER", "ADMIN"):
        return Response({"detail": "Forbidden"}, status=403)

    if user.role == "TEACHER":
        allowed = Schedule.objects.filter(teacher=user, section_id=section_id).exists()
        if not allowed:
            return Response({"detail": "Forbidden"}, status=403)

    students_map = {}

    enrollments = Enrollment.objects.filter(
        section_id=section_id,
        status="ACTIVE",
    ).select_related("student", "student__profile")

    for enr in enrollments:
        stu = enr.student
        if not stu:
            continue
        full_name = " ".join(
            p for p in [enr.first_name or "", enr.last_name or ""] if p
        ).strip()
        if not full_name and hasattr(stu, "profile") and stu.profile:
            full_name = " ".join(
                p for p in [stu.profile.student_first_name or "", stu.profile.student_last_name or ""] if p
            ).strip()
        if not full_name:
            full_name = stu.username

        students_map[stu.id] = {
            "id": stu.id,
            "username": stu.username,
            "student_name": full_name,
        }

    legacy_profiles = UserProfile.objects.filter(
        section_id=section_id,
        user__role="PARENT_STUDENT",
        user__status="ACTIVE",
    ).select_related("user")

    for p in legacy_profiles:
        stu = p.user
        if stu.id in students_map:
            continue
        full_name = " ".join(
            part for part in [p.student_first_name or "", p.student_last_name or ""] if part
        ).strip() or stu.username
        students_map[stu.id] = {
            "id": stu.id,
            "username": stu.username,
            "student_name": full_name,
        }

    result = sorted(students_map.values(), key=lambda s: (s["student_name"].lower(), s["id"]))
    return Response(result)


# ══════════════════════════════════════════════════════
# ACADEMIC HISTORY  —  persisted historical records
# ══════════════════════════════════════════════════════
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_academic_history(request):
    """
    Student reads their own historical academic records, grouped by school year.
    Returns: { has_history: bool, records_by_year: [ { school_year, grade_level, records: [...] } ] }
    """
    user = request.user
    if user.role != "PARENT_STUDENT":
        return Response({"detail": "Forbidden"}, status=403)

    records = AcademicRecord.objects.filter(student=user).order_by("-school_year", "subject_name")
    serialized = AcademicRecordSerializer(records, many=True).data

    grouped = {}
    for rec in serialized:
        sy = rec["school_year"]
        if sy not in grouped:
            grouped[sy] = {
                "school_year": sy,
                "grade_level": rec["grade_level"],
                "section_name": rec["section_name"],
                "records": [],
            }
        grouped[sy]["records"].append(rec)

    records_by_year = sorted(grouped.values(), key=lambda g: g["school_year"], reverse=True)

    return Response({
        "has_history": len(records_by_year) > 0,
        "records_by_year": records_by_year,
    })


class AcademicRecordListCreate(generics.ListCreateAPIView):
    """
    Admin / Teacher: list all academic records (with filters) or create one.
    POST body: { student, school_year, grade_level, section_name, subject_name, subject_code,
                 q1, q2, q3, q4, final_grade, remarks, teacher_name }
    """
    serializer_class = AcademicRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role not in ("ADMIN", "TEACHER"):
            return AcademicRecord.objects.none()
        qs = AcademicRecord.objects.select_related("student", "student__profile", "recorded_by").all()
        student_id = self.request.query_params.get("student")
        school_year = self.request.query_params.get("school_year")
        if student_id:
            qs = qs.filter(student_id=student_id)
        if school_year:
            qs = qs.filter(school_year=school_year)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ("ADMIN", "TEACHER"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins and teachers can create academic records.")
        serializer.save(recorded_by=user)


class AcademicRecordDetail(generics.RetrieveUpdateDestroyAPIView):
    """Admin / Teacher: retrieve, update or delete a single academic record."""
    serializer_class = AcademicRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role not in ("ADMIN", "TEACHER"):
            return AcademicRecord.objects.none()
        return AcademicRecord.objects.all()

    def perform_update(self, serializer):
        serializer.save(recorded_by=self.request.user)
        
  
  
  
# ══════════════════════════════════════════════════════
# Student  —  re-enrollment eligibility check
# ══════════════════════════════════════════════════════       

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_reenrollment_eligibility(request):
    user = request.user
    if user.role != "PARENT_STUDENT":
        return Response({"detail": "Forbidden"}, status=403)

    profile = getattr(user, "profile", None)

    current_grade = None
    if profile and profile.grade_level:
        current_grade = str(profile.grade_level).strip().lower()
    else:
        latest_enrollment = (
            Enrollment.objects.filter(parent_user=user)
            .order_by("-created_at", "-id")
            .first()
        )
        if latest_enrollment and latest_enrollment.grade_level:
            current_grade = str(latest_enrollment.grade_level).strip().lower()

    next_grade_map = {
        "prek": "kinder",
        "kinder": "grade1",
        "grade1": "grade2",
        "grade2": "grade3",
        "grade3": "grade4",
        "grade4": "grade5",
        "grade5": "grade6",
        "grade6": None,
    }
    next_grade = next_grade_map.get(current_grade)

    totals = Transaction.objects.filter(parent=user).aggregate(
        total_debit=Sum("debit"),
        total_credit=Sum("credit"),
    )
    total_debit = Decimal(str(totals.get("total_debit") or 0))
    total_credit = Decimal(str(totals.get("total_credit") or 0))
    outstanding_balance = total_debit - total_credit
    if outstanding_balance < 0:
        outstanding_balance = Decimal("0.00")

    grades = my_grades(request).data
    grades = grades if isinstance(grades, list) else []

    total_subjects = len(grades)
    incomplete_subjects = 0
    failed_subjects = 0
    passed_subjects = 0

    for row in grades:
        final_grade = row.get("final_grade")
        if final_grade is None:
            incomplete_subjects += 1
        elif float(final_grade) < 75:
            failed_subjects += 1
        else:
            passed_subjects += 1

    completed_subjects = total_subjects - incomplete_subjects

    grade6_completed = current_grade == "grade6"
    has_balance = outstanding_balance > 0
    has_incomplete_grades = incomplete_subjects > 0
    has_failing_grades = failed_subjects > 0

    eligible = not (
        has_balance
        or has_incomplete_grades
        or has_failing_grades
        or grade6_completed
    )

    if grade6_completed:
        message = "Congratulations! You already completed Grade 6. No further re-enrollment is needed."
    elif has_balance:
        message = f"You still have an outstanding balance of ₱{outstanding_balance:,.2f}."
    elif has_incomplete_grades:
        message = "You have incomplete grades. Please wait until all subjects have final grades."
    elif has_failing_grades:
        message = "You have failing grades. Please coordinate with the school before re-enrollment."
    elif next_grade:
        message = f"You are eligible to re-enroll for {grade_level_label(normalize_grade_level(next_grade))}."
    else:
        message = "You are eligible to re-enroll."

    return Response({
        "eligible": eligible,
        "current_grade": current_grade,
        "next_grade": next_grade,
        "outstanding_balance": float(outstanding_balance),
        "has_balance": has_balance,
        "has_incomplete_grades": has_incomplete_grades,
        "has_failing_grades": has_failing_grades,
        "grade6_completed": grade6_completed,
        "message": message,
        "grade_summary": {
            "total_subjects": total_subjects,
            "completed_subjects": completed_subjects,
            "incomplete_subjects": incomplete_subjects,
            "failed_subjects": failed_subjects,
            "passed_subjects": passed_subjects,
        },
    })