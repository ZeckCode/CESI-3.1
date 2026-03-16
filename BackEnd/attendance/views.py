from datetime import date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Q

from .models import AttendanceRecord
from .serializers import (
    AttendanceRecordSerializer,
    BulkAttendanceSerializer,
    SectionSimpleSerializer,
)
from accounts.models import Section, User


class TeacherSectionsView(APIView):
    """
    Get sections that the current teacher teaches.
    Based on class schedules assigned to them, adviser status, and profile assignment.
    Falls back to all sections if no specific assignment exists.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "TEACHER":
            return Response(
                {"error": "Only teachers can access this endpoint"},
                status=status.HTTP_403_FORBIDDEN,
            )

        section_ids = set()

        # 1. Get sections from teacher's schedules
        from classmanagement.models import Schedule
        schedule_section_ids = Schedule.objects.filter(
            teacher=user
        ).values_list("section_id", flat=True).distinct()
        section_ids.update(schedule_section_ids)

        # 2. Get sections where teacher is adviser or assigned
        try:
            teacher_profile = user.teacher_profile
            # Section where this teacher is adviser
            adviser_section = Section.objects.filter(adviser=teacher_profile).values_list("id", flat=True)
            section_ids.update(adviser_section)
            
            # Section directly assigned to teacher profile
            if teacher_profile.section_id:
                section_ids.add(teacher_profile.section_id)
        except Exception:
            pass  # Teacher profile might not exist

        # 3. If no sections found through assignments, show all sections (fallback)
        if section_ids:
            sections = Section.objects.filter(id__in=section_ids)
        else:
            sections = Section.objects.all()

        serializer = SectionSimpleSerializer(sections, many=True)
        return Response(serializer.data)


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    """
    ViewSet for attendance records.
    """
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = AttendanceRecord.objects.select_related(
            "student",
            "student__profile",
            "section",
            "marked_by",
            "subject",
            "schedule",
            "schedule__subject",
        )

        # Filter by section if provided
        section_id = self.request.query_params.get("section")
        if section_id:
            queryset = queryset.filter(section_id=section_id)

        # Filter by date if provided
        date_param = self.request.query_params.get("date")
        if date_param:
            queryset = queryset.filter(date=date_param)

        # Filter by schedule (subject period) if provided
        schedule_id = self.request.query_params.get("schedule")
        if schedule_id:
            queryset = queryset.filter(schedule_id=schedule_id)

        # Filter by date range
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        # Hide legacy unlinked rows by default. Keep an escape hatch for diagnostics.
        include_unlinked = self.request.query_params.get("include_unlinked") == "1"
        if not include_unlinked:
            queryset = queryset.filter(subject__isnull=False)

        return queryset

    def perform_create(self, serializer):
        serializer.save(marked_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(marked_by=self.request.user)

    @action(detail=False, methods=["post"])
    def bulk_upsert(self, request):
        """
        Create or update attendance records in bulk.
        Now supports per-subject attendance with optional schedule field.
        Expected payload:
        {
            "section": 1,
            "date": "2025-01-15",
            "schedule": 5,  // optional - for per-subject attendance
            "records": [
                {"student_id": 10, "status": "PRESENT", "notes": ""},
                {"student_id": 11, "status": "ABSENT", "notes": "Sick"},
            ]
        }
        """
        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        section_id = serializer.validated_data["section"]
        record_date = serializer.validated_data["date"]
        schedule_id = serializer.validated_data.get("schedule", None)
        subject_id = serializer.validated_data.get("subject", None)
        records = serializer.validated_data["records"]

        if schedule_id is not None:
            from classmanagement.models import Schedule
            schedule_obj = Schedule.objects.select_related("subject").filter(
                id=schedule_id,
                section_id=section_id,
            ).first()
            if not schedule_obj:
                return Response(
                    {"error": "Selected schedule is invalid for the given section."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Canonical subject comes from schedule when schedule is provided.
            subject_id = schedule_obj.subject_id

        created_count = 0
        updated_count = 0

        for record_data in records:
            student_id = record_data["student_id"]
            status_value = record_data["status"]
            notes = record_data.get("notes", "")

            # Use schedule in update_or_create if provided
            lookup = {
                "student_id": student_id,
                "date": record_date,
                "schedule_id": schedule_id,
            }
            defaults = {
                "section_id": section_id,
                "status": status_value,
                "notes": notes,
                "marked_by": request.user,
                "subject_id": subject_id,
            }

            obj, created = AttendanceRecord.objects.update_or_create(
                **lookup,
                defaults=defaults,
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        return Response({
            "message": f"Attendance saved: {created_count} created, {updated_count} updated",
            "created": created_count,
            "updated": updated_count,
        })

    @action(detail=False, methods=["get"])
    def section_students(self, request):
        """
        Get all students enrolled in a section.
        Used to populate the attendance list.
        """
        section_id = request.query_params.get("section")
        if not section_id:
            return Response(
                {"error": "section parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get students enrolled in this section
        from enrollment.models import Enrollment
        enrollments = (
            Enrollment.objects.filter(section_id=section_id, status="ACTIVE")
            .select_related("student", "student__profile")
            .prefetch_related("parent_info")
            .order_by("last_name", "first_name")
        )

        students = []
        for enrollment in enrollments:
            student = enrollment.student

            # Resolve display name
            if enrollment.first_name and enrollment.last_name:
                name = f"{enrollment.first_name} {enrollment.last_name}"
                first_name = enrollment.first_name
                last_name = enrollment.last_name
            elif hasattr(student, "profile") and student.profile:
                p = student.profile
                first_name = p.student_first_name or ""
                last_name = p.student_last_name or ""
                name = f"{first_name} {last_name}".strip() or student.username
            else:
                first_name = ""
                last_name = ""
                name = student.username

            # Resolve guardian info from ParentInfo record
            guardian_name = ""
            guardian_contact = ""
            try:
                pi = enrollment.parent_info
                guardian_name = (
                    pi.guardian_name
                    or pi.father_name
                    or pi.mother_name
                    or ""
                )
                guardian_contact = (
                    pi.guardian_contact
                    or pi.father_contact
                    or pi.mother_contact
                    or ""
                )
            except Exception:
                pass

            students.append({
                "id": student.id,
                "username": student.username,
                "name": name,
                "first_name": first_name,
                "last_name": last_name,
                "email": enrollment.email or getattr(student, "email", "") or "",
                "lrn": enrollment.lrn or "",
                "gender": enrollment.gender or "",
                "grade_level": enrollment.grade_level or "",
                "payment_mode": enrollment.payment_mode or "",
                "guardian_name": guardian_name,
                "guardian_contact": guardian_contact,
            })

        return Response(students)

    @action(detail=False, methods=["get"])
    def history(self, request):
        """
        Get attendance history for a section, grouped by date.
        """
        section_id = request.query_params.get("section")
        if not section_id:
            return Response(
                {"error": "section parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get unique dates with attendance
        records = AttendanceRecord.objects.filter(
            section_id=section_id,
            subject__isnull=False,
        ).order_by("-date")

        # Optional schedule filter for per-subject history views
        schedule_id = request.query_params.get("schedule")
        if schedule_id:
            records = records.filter(schedule_id=schedule_id)

        # Filter by date range if provided (for quarter filtering)
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        if start_date:
            records = records.filter(date__gte=start_date)
        if end_date:
            records = records.filter(date__lte=end_date)

        # Group by date
        dates = records.values_list("date", flat=True).distinct()

        history = []
        for record_date in dates:
            day_records = records.filter(date=record_date)
            present = day_records.filter(status="PRESENT").count()
            absent = day_records.filter(status="ABSENT").count()
            late = day_records.filter(status="LATE").count()
            excused = day_records.filter(status="EXCUSED").count()
            total = day_records.count()

            history.append({
                "date": record_date,
                "total": total,
                "present": present,
                "absent": absent,
                "late": late,
                "excused": excused,
            })

        return Response(history)

    @action(detail=False, methods=["get"])
    def quarter_stats(self, request):
        """
        Get attendance statistics for all students in a grade level for a specific quarter.
        Used by Grade Encoding to show attendance percentage.
        """
        grade_level = request.query_params.get("grade_level")
        quarter = request.query_params.get("quarter")

        if not grade_level or not quarter:
            return Response(
                {"error": "grade_level and quarter parameters are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get quarter date range - school year starts in June
        from datetime import date as date_class
        today = date_class.today()
        # Determine school year: if month >=6, SY starts this year; else SY started last year
        sy_start_year = today.year if today.month >= 6 else today.year - 1
        quarter = int(quarter)
        quarter_ranges = {
            1: (date_class(sy_start_year, 6, 1), date_class(sy_start_year, 8, 31)),
            2: (date_class(sy_start_year, 9, 1), date_class(sy_start_year, 11, 30)),
            3: (date_class(sy_start_year, 12, 1), date_class(sy_start_year + 1, 2, 28)),
            4: (date_class(sy_start_year + 1, 3, 1), date_class(sy_start_year + 1, 5, 31)),
        }
        quarter_start, quarter_end = quarter_ranges.get(quarter, (None, None))

        if not quarter_start:
            return Response({"error": "Invalid quarter"}, status=status.HTTP_400_BAD_REQUEST)

        # Get students enrolled in sections of this grade level
        from enrollment.models import Enrollment
        enrollments = Enrollment.objects.filter(
            section__grade_level=int(grade_level),
            status="ACTIVE",
        ).select_related("student")

        results = []
        for enrollment in enrollments:
            student = enrollment.student
            stats = AttendanceRecord.get_student_attendance_stats(
                student.id, quarter_start, quarter_end
            )
            results.append({
                "student_id": student.id,
                "total": stats["total"],
                "present": stats["present"],
                "absent": stats["absent"],
                "late": stats["late"],
                "excused": stats["excused"],
                "percentage": stats["percentage"],
            })

        return Response(results)


class StudentAttendanceView(APIView):
    """
    Endpoints for students to view their own attendance.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get the current student's attendance records.
        Query params:
        - month: filter by month (1-12)
        - year: filter by year
        - date: get records for specific date (for daily detail view)
        """
        user = request.user
        if user.role != "PARENT_STUDENT":
            return Response(
                {"error": "Only students can access this endpoint"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if requesting daily detail
        date_param = request.query_params.get("date")
        if date_param:
            records = AttendanceRecord.get_daily_summary(user.id, date_param)
            return Response({
                "records": records,
                "summary": {
                    "total": len(records),
                    "present": sum(1 for r in records if r["status"] == "PRESENT"),
                    "late": sum(1 for r in records if r["status"] == "LATE"),
                    "absent": sum(1 for r in records if r["status"] == "ABSENT"),
                    "excused": sum(1 for r in records if r["status"] == "EXCUSED"),
                },
            })

        # Otherwise return monthly attendance overview
        records_qs = AttendanceRecord.objects.filter(
            student=user,
            subject__isnull=False,
        ).select_related("subject", "schedule", "schedule__subject").order_by("-date")

        # Filter by month/year if provided
        month = request.query_params.get("month")
        year = request.query_params.get("year")
        if month:
            records_qs = records_qs.filter(date__month=int(month))
        if year:
            records_qs = records_qs.filter(date__year=int(year))

        # Evaluate once — used for both the subjects list and calendar aggregation
        all_records = list(records_qs)

        # Derive distinct subject names (always unfiltered so the dropdown stays populated)
        def resolve_subject_name(record):
            if record.subject:
                return record.subject.name
            if record.schedule and record.schedule.subject:
                return record.schedule.subject.name
            return None

        subjects = sorted(set(
            name
            for name in (resolve_subject_name(r) for r in all_records)
            if name
        ))

        # Apply optional subject filter for calendar aggregation
        subject_param = request.query_params.get("subject", "").strip()
        working_records = (
            [
                r for r in all_records
                if (resolve_subject_name(r) or "").lower() == subject_param.lower()
            ]
            if subject_param else all_records
        )

        # Group by date for calendar view
        from collections import defaultdict
        daily_data = defaultdict(lambda: {"present": 0, "absent": 0, "late": 0, "excused": 0, "total": 0})

        for record in working_records:
            day = record.date.isoformat()
            daily_data[day]["total"] += 1
            if record.status == "PRESENT":
                daily_data[day]["present"] += 1
            elif record.status == "ABSENT":
                daily_data[day]["absent"] += 1
            elif record.status == "LATE":
                daily_data[day]["late"] += 1
            elif record.status == "EXCUSED":
                daily_data[day]["excused"] += 1

        # Determine overall status for each day (for calendar coloring)
        calendar_data = []
        for day, counts in daily_data.items():
            total = counts["total"]
            if total == 0:
                overall = "none"
            elif counts["absent"] > 0:
                overall = "partial" if counts["present"] + counts["late"] > 0 else "absent"
            elif counts["late"] > 0:
                overall = "late"
            else:
                overall = "present"

            calendar_data.append({
                "date": day,
                "present": counts["present"],
                "absent": counts["absent"],
                "late": counts["late"],
                "excused": counts["excused"],
                "total": total,
                "overall_status": overall,
            })

        return Response({
            "subjects": subjects,
            "calendar": sorted(calendar_data, key=lambda x: x["date"], reverse=True),
        })


class StudentAttendanceStatsView(APIView):
    """
    Get attendance statistics for the current student.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "PARENT_STUDENT":
            return Response(
                {"error": "Only students can access this endpoint"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get current school year date range
        from datetime import date as date_class
        today = date_class.today()
        sy_start_year = today.year if today.month >= 6 else today.year - 1
        sy_start = date_class(sy_start_year, 6, 1)
        sy_end = date_class(sy_start_year + 1, 5, 31)

        stats = AttendanceRecord.get_student_attendance_stats(
            user.id, sy_start, sy_end
        )

        return Response({
            "school_year": f"{sy_start_year}-{sy_start_year + 1}",
            **stats,
        })
