from datetime import date
from collections import Counter
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Q
from django.utils.text import slugify

from .models import AttendanceRecord
from .serializers import (
    AttendanceRecordSerializer,
    BulkAttendanceSerializer,
    SectionSimpleSerializer,
)
from accounts.models import Section, User, UserProfile
from enrollment.models import Enrollment
from classmanagement.models import Schedule, SchoolYear


class TeacherSectionsView(APIView):
    """
    Get sections that the current teacher teaches.
    Based on class schedules assigned to them, adviser status, profile section,
    and legacy unassigned rows that match teacher subject assignments.
    Always scoped to the currently active school year.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "TEACHER":
            return Response(
                {"error": "Only teachers can access this endpoint"},
                status=status.HTTP_403_FORBIDDEN,
            )

        active_sy = SchoolYear.objects.filter(is_active=True).first()
        if not active_sy:
            return Response([])

        section_ids = set()

        # 1. Sections from schedules in active school year.
        schedule_filters = Q(teacher=user) | Q(teacher__isnull=True, section__adviser__user=user)

        teacher_profile = getattr(user, "teacher_profile", None)
        if teacher_profile:
            subject_ids = set(teacher_profile.subjects.values_list("id", flat=True))
            if teacher_profile.subject_id:
                subject_ids.add(teacher_profile.subject_id)

            if teacher_profile.section_id:
                schedule_filters |= Q(teacher__isnull=True, section_id=teacher_profile.section_id)
            if subject_ids:
                schedule_filters |= Q(teacher__isnull=True, subject_id__in=list(subject_ids))

        schedule_section_ids = Schedule.objects.filter(
            schedule_filters,
            school_year=active_sy,
        ).values_list("section_id", flat=True).distinct()
        section_ids.update(schedule_section_ids)

        # 2. Additional explicit teacher section assignments, still active SY only.
        if teacher_profile:
            adviser_section = Section.objects.filter(
                adviser=teacher_profile,
                school_year=active_sy,
            ).values_list("id", flat=True)
            section_ids.update(adviser_section)

            if teacher_profile.section_id and Section.objects.filter(
                id=teacher_profile.section_id,
                school_year=active_sy,
            ).exists():
                section_ids.add(teacher_profile.section_id)

        sections = Section.objects.filter(id__in=section_ids, school_year=active_sy).order_by("grade_level", "name")

        serializer = SectionSimpleSerializer(sections, many=True)
        return Response(serializer.data)


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    """
    ViewSet for attendance records.
    """
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _normalize_grade_level_param(value):
        if value is None:
            return None

        raw = str(value).strip().lower()
        if not raw:
            return None

        grade_map = {
            "prek": "prek",
            "pre-kinder": "prek",
            "pre kinder": "prek",
            "kinder": "kinder",
            "0": "kinder",
            "grade1": "grade1",
            "grade 1": "grade1",
            "1": "grade1",
            "grade2": "grade2",
            "grade 2": "grade2",
            "2": "grade2",
            "grade3": "grade3",
            "grade 3": "grade3",
            "3": "grade3",
            "grade4": "grade4",
            "grade 4": "grade4",
            "4": "grade4",
            "grade5": "grade5",
            "grade 5": "grade5",
            "5": "grade5",
            "grade6": "grade6",
            "grade 6": "grade6",
            "6": "grade6",
        }

        if raw in grade_map:
            return grade_map[raw]

        if raw.startswith("grade "):
            suffix = raw[6:].strip()
            if suffix.isdigit():
                return f"grade{suffix}"

        if raw.isdigit():
            return f"grade{raw}"

        return raw

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
        section_param = self.request.query_params.get("section")
        if section_param:
            section_raw = str(section_param).strip()
            if section_raw.isdigit():
                queryset = queryset.filter(section_id=int(section_raw))
            else:
                queryset = queryset.filter(section__name__iexact=section_raw)

        # Optional grade-level filter (used by admin Grades Records attendance tab).
        grade_level_param = self.request.query_params.get("grade_level")
        normalized_grade_level = self._normalize_grade_level_param(grade_level_param)
        if normalized_grade_level:
            queryset = queryset.filter(section__grade_level=normalized_grade_level)

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
            queryset = queryset.filter(Q(subject__isnull=False) | Q(schedule__isnull=False))

        return queryset

    def perform_create(self, serializer):
        serializer.save(marked_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(marked_by=self.request.user)

    def _resolve_student_id_from_record(self, record_data, section_id=None):
        student_number = str(record_data.get("student_number") or "").strip()
        if student_number:
            # Student number/LRN is canonical in enrollment rows after approval flows.
            # Resolve enrollment first to avoid accidentally targeting placeholder users.
            enrollment_qs = Enrollment.objects.filter(status="ACTIVE")
            if section_id is not None:
                enrollment_qs = enrollment_qs.filter(section_id=section_id)
            enrollment_match = (
                enrollment_qs.filter(Q(student_number=student_number) | Q(lrn=student_number))
                .select_related("parent_user", "student")
                .order_by("-updated_at", "-id")
                .first()
            )
            if enrollment_match:
                resolved_user = enrollment_match.parent_user or enrollment_match.student
                if resolved_user:
                    return int(resolved_user.id), None

            # Fallback for legacy records where number/LRN only exists on profile.
            profile = (
                UserProfile.objects.select_related("user")
                .filter(Q(student_number=student_number) | Q(lrn=student_number))
                .first()
            )
            if profile and profile.user_id:
                return int(profile.user_id), None

            return None, f"No student found for student_number '{student_number}'."

        student_id = record_data.get("student_id")
        if student_id in [None, "", "null"]:
            return None, "Missing student_number or student_id in record."

        try:
            return int(student_id), None
        except (TypeError, ValueError):
            return None, f"Invalid student_id '{student_id}'."

    def _normalize_bulk_records(self, records, section_id=None):
        normalized_records = []
        identifier_errors = []

        for idx, record in enumerate(records):
            student_id, error = self._resolve_student_id_from_record(record, section_id=section_id)
            if error:
                identifier_errors.append(
                    {
                        "index": idx,
                        "student_id": record.get("student_id"),
                        "student_number": record.get("student_number"),
                        "error": error,
                    }
                )
                continue

            next_record = dict(record)
            next_record["student_id"] = student_id
            normalized_records.append(next_record)

        return normalized_records, identifier_errors

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

        normalized_records, identifier_errors = self._normalize_bulk_records(
            records,
            section_id=section_id,
        )
        if identifier_errors:
            return Response(
                {
                    "error": "Some attendance records could not be matched to a student.",
                    "details": identifier_errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Protect against accidental payload corruption where multiple rows point
        # to the same student_id (would overwrite each other and appear as reset).
        student_ids = [int(r["student_id"]) for r in normalized_records if r.get("student_id") is not None]
        duplicate_student_ids = sorted(
            [student_id for student_id, count in Counter(student_ids).items() if count > 1]
        )
        if duplicate_student_ids:
            return Response(
                {
                    "error": "Duplicate student IDs in payload. Check section student mapping before saving attendance.",
                    "duplicate_student_ids": duplicate_student_ids,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        for record_data in normalized_records:
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

    @action(detail=False, methods=["post"])
    def bulk_update(self, request):
        """
        Update attendance records in bulk without creating new rows.
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

        normalized_records, identifier_errors = self._normalize_bulk_records(
            records,
            section_id=section_id,
        )
        if identifier_errors:
            return Response(
                {
                    "error": "Some attendance records could not be matched to a student.",
                    "details": identifier_errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        student_ids = [int(r["student_id"]) for r in normalized_records if r.get("student_id") is not None]
        duplicate_student_ids = sorted(
            [student_id for student_id, count in Counter(student_ids).items() if count > 1]
        )
        if duplicate_student_ids:
            return Response(
                {
                    "error": "Duplicate student IDs in payload. Check section student mapping before updating attendance.",
                    "duplicate_student_ids": duplicate_student_ids,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

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
            subject_id = schedule_obj.subject_id

        updated_count = 0
        skipped_count = 0

        for record_data in normalized_records:
            student_id = record_data["student_id"]
            status_value = record_data["status"]
            notes = record_data.get("notes", "")

            record = AttendanceRecord.objects.filter(
                student_id=student_id,
                date=record_date,
                schedule_id=schedule_id,
            ).first()

            if not record:
                skipped_count += 1
                continue

            record.section_id = section_id
            record.status = status_value
            record.notes = notes
            record.marked_by = request.user
            record.subject_id = subject_id
            record.save()
            updated_count += 1

        return Response({
            "message": f"Attendance updated: {updated_count} updated, {skipped_count} skipped",
            "updated": updated_count,
            "skipped": skipped_count,
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
            .select_related("student", "student__profile", "parent_user", "parent_user__profile", "parent_info")
            .order_by("last_name", "first_name")
        )

        def ensure_attendance_user(enrollment):
            # Canonical account after approval flow.
            if enrollment.parent_user_id:
                return enrollment.parent_user

            # Legacy records may still point to a shared placeholder account.
            if enrollment.student_id and enrollment.student and enrollment.student.username != "public_user":
                return enrollment.student

            candidate = None
            email = (enrollment.email or "").strip().lower()

            if email:
                candidate = User.objects.filter(
                    email__iexact=email,
                    role="PARENT_STUDENT",
                ).first()

            if not candidate:
                raw_seed = (
                    (enrollment.student_number or "").strip()
                    or (enrollment.lrn or "").strip()
                    or f"enrollment{enrollment.id}"
                )
                safe_seed = slugify(raw_seed).replace("-", "") or f"enrollment{enrollment.id}"

                base_username = f"{safe_seed}@cesi.edu.ph"
                username = base_username
                idx = 1
                while User.objects.filter(username=username).exists():
                    idx += 1
                    username = f"{safe_seed}{idx}@cesi.edu.ph"

                user_email = email
                if not user_email:
                    user_email = f"{safe_seed}+{enrollment.id}@cesi.local"
                elif User.objects.filter(email__iexact=user_email).exists():
                    user_email = f"{safe_seed}+{enrollment.id}@cesi.local"

                candidate = User.objects.create(
                    username=username,
                    email=user_email,
                    role="PARENT_STUDENT",
                    status="ACTIVE",
                    is_active=True,
                )
                candidate.set_unusable_password()
                candidate.save(update_fields=["password"])

            update_fields = []
            if enrollment.parent_user_id != candidate.id:
                enrollment.parent_user = candidate
                update_fields.append("parent_user")

            if (
                not enrollment.student_id
                or (enrollment.student and enrollment.student.username == "public_user")
            ) and enrollment.student_id != candidate.id:
                enrollment.student = candidate
                update_fields.append("student")

            if update_fields:
                enrollment.save(update_fields=update_fields)

            return candidate

        students = []
        for enrollment in enrollments:
            # Attendance should target the active portal account linked to enrollment.
            # parent_user is the canonical per-student portal account after approval.
            student = ensure_attendance_user(enrollment)
            if not student:
                continue

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
            student_profile = getattr(student, "profile", None)
            student_number = (
                getattr(student_profile, "student_number", None)
                or enrollment.student_number
                or enrollment.lrn
                or ""
            )
            lrn_value = (
                getattr(student_profile, "lrn", None)
                or enrollment.lrn
                or ""
            )
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
                "enrollment_id": enrollment.id,
                "name": name,
                "first_name": first_name,
                "last_name": last_name,
                "email": enrollment.email or getattr(student, "email", "") or "",
                "student_number": student_number,
                "lrn": lrn_value,
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
        ).filter(
            Q(subject__isnull=False) | Q(schedule__isnull=False)
        ).filter(
            status__in=AttendanceRecord.STATUS_VALUES,
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

        active_sy = SchoolYear.objects.filter(is_active=True).first()
        if not active_sy:
            return Response({"error": "No active school year"}, status=status.HTTP_404_NOT_FOUND)

        # Get quarter date range using active school year start.
        from datetime import date as date_class
        sy_start_year = active_sy.start_date.year
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
            section__school_year=active_sy,
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

    @staticmethod
    def _resolve_attendance_user(user):
        # Student portal attendance is always scoped to the authenticated account.
        return user

    @staticmethod
    def _dedupe_records(records):
        latest_by_key = {}
        for record in records:
            dedupe_key = (record.date, record.schedule_id, record.subject_id)
            current = latest_by_key.get(dedupe_key)
            if current is None or (record.updated_at, record.id) > (current.updated_at, current.id):
                latest_by_key[dedupe_key] = record
        return list(latest_by_key.values())

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

        active_sy = SchoolYear.objects.filter(is_active=True).first()
        if not active_sy:
            return Response(
                {"error": "No active school year"},
                status=status.HTTP_404_NOT_FOUND,
            )

        attendance_user = self._resolve_attendance_user(user)
        debug = request.query_params.get("debug") == "1"

        # Check if requesting daily detail
        date_param = request.query_params.get("date")
        if date_param:
            daily_records_qs = AttendanceRecord.objects.filter(
                student_id=attendance_user.id,
                date=date_param,
            ).filter(
                Q(subject__isnull=False) | Q(schedule__isnull=False)
            ).filter(
                Q(section__school_year=active_sy) | Q(schedule__school_year=active_sy)
            ).filter(
                status__in=AttendanceRecord.STATUS_VALUES,
            ).select_related("subject", "schedule", "schedule__subject", "schedule__teacher")

            daily_records = self._dedupe_records(
                list(daily_records_qs.order_by("date", "schedule__start_time", "-updated_at", "-id"))
            )

            records = []
            for record in daily_records:
                subject_name = None
                subject_code = None

                if record.subject:
                    subject_name = record.subject.name
                    subject_code = record.subject.code
                elif record.schedule and record.schedule.subject:
                    subject_name = record.schedule.subject.name
                    subject_code = record.schedule.subject.code

                if record.schedule:
                    records.append({
                        "schedule_id": record.schedule.id,
                        "subject_name": subject_name or "Homeroom",
                        "subject_code": subject_code or "HR",
                        "start_time": record.schedule.start_time.strftime("%H:%M"),
                        "end_time": record.schedule.end_time.strftime("%H:%M"),
                        "teacher": record.schedule.teacher.username if record.schedule.teacher else None,
                        "status": record.status,
                        "notes": record.notes,
                    })
                else:
                    records.append({
                        "schedule_id": None,
                        "subject_name": subject_name or "Homeroom",
                        "subject_code": subject_code or "HR",
                        "start_time": None,
                        "end_time": None,
                        "teacher": None,
                        "status": record.status,
                        "notes": record.notes,
                    })

            payload = {
                "records": records,
                "summary": {
                    "total": len(records),
                    "present": sum(1 for r in records if r["status"] == "PRESENT"),
                    "late": sum(1 for r in records if r["status"] == "LATE"),
                    "absent": sum(1 for r in records if r["status"] == "ABSENT"),
                    "excused": sum(1 for r in records if r["status"] == "EXCUSED"),
                },
            }
            if debug:
                payload["request_user_id"] = user.id
                payload["resolved_student_id"] = attendance_user.id
            return Response(payload)

        # Otherwise return monthly attendance overview
        records_qs = AttendanceRecord.objects.filter(
            student=attendance_user,
        ).filter(
            Q(subject__isnull=False) | Q(schedule__isnull=False)
        ).filter(
            Q(section__school_year=active_sy) | Q(schedule__school_year=active_sy)
        ).filter(
            status__in=AttendanceRecord.STATUS_VALUES,
        ).select_related("subject", "schedule", "schedule__subject").order_by("-date")

        # Filter by month/year if provided
        month = request.query_params.get("month")
        year = request.query_params.get("year")
        if month:
            records_qs = records_qs.filter(date__month=int(month))
        if year:
            records_qs = records_qs.filter(date__year=int(year))

        # Evaluate once — used for both the subjects list and calendar aggregation
        all_records = self._dedupe_records(
            list(records_qs.order_by("date", "schedule_id", "subject_id", "-updated_at", "-id"))
        )

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
            if record.status not in AttendanceRecord.STATUS_VALUES:
                continue
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
                continue

            status_flags = {
                "absent": counts["absent"] > 0,
                "late": counts["late"] > 0,
                "excused": counts["excused"] > 0,
                "present": counts["present"] > 0,
            }
            active_statuses = [key for key, active in status_flags.items() if active]

            if len(active_statuses) > 1:
                overall = "partial"
            elif status_flags["absent"]:
                overall = "absent"
            elif status_flags["late"]:
                overall = "late"
            elif status_flags["excused"]:
                overall = "excused"
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

        payload = {
            "subjects": subjects,
            "calendar": sorted(calendar_data, key=lambda x: x["date"], reverse=True),
        }
        if debug:
            payload["request_user_id"] = user.id
            payload["resolved_student_id"] = attendance_user.id
        return Response(payload)


class StudentAttendanceStatsView(APIView):
    """
    Get attendance statistics for the current student.
    """
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _resolve_attendance_user(user):
        # Student portal attendance is always scoped to the authenticated account.
        return user

    @staticmethod
    def _dedupe_records(records):
        latest_by_key = {}
        for record in records:
            dedupe_key = (record.date, record.schedule_id, record.subject_id)
            current = latest_by_key.get(dedupe_key)
            if current is None or (record.updated_at, record.id) > (current.updated_at, current.id):
                latest_by_key[dedupe_key] = record
        return list(latest_by_key.values())

    def get(self, request):
        user = request.user
        if user.role != "PARENT_STUDENT":
            return Response(
                {"error": "Only students can access this endpoint"},
                status=status.HTTP_403_FORBIDDEN,
            )

        active_sy = SchoolYear.objects.filter(is_active=True).first()
        if not active_sy:
            return Response(
                {"error": "No active school year"},
                status=status.HTTP_404_NOT_FOUND,
            )

        attendance_user = self._resolve_attendance_user(user)
        debug = request.query_params.get("debug") == "1"

        records_qs = AttendanceRecord.objects.filter(
            student_id=attendance_user.id,
            date__gte=active_sy.start_date,
            date__lte=active_sy.end_date,
        ).filter(
            Q(subject__isnull=False) | Q(schedule__isnull=False)
        ).filter(
            Q(section__school_year=active_sy) | Q(schedule__school_year=active_sy)
        ).filter(
            status__in=AttendanceRecord.STATUS_VALUES,
        )

        deduped_records = self._dedupe_records(
            list(records_qs.only("id", "date", "status", "schedule_id", "subject_id", "updated_at"))
        )
        status_counts = Counter(
            record.status for record in deduped_records if record.status in AttendanceRecord.STATUS_VALUES
        )

        total = len(deduped_records)
        present = status_counts.get("PRESENT", 0)
        absent = status_counts.get("ABSENT", 0)
        late = status_counts.get("LATE", 0)
        excused = status_counts.get("EXCUSED", 0)
        attended = present + late + excused
        percentage = round((attended / total) * 100, 2) if total else None

        payload = {
            "school_year": active_sy.name,
            "total": total,
            "present": present,
            "absent": absent,
            "late": late,
            "excused": excused,
            "attended": attended,
            "percentage": percentage,
        }
        if debug:
            payload["request_user_id"] = user.id
            payload["resolved_student_id"] = attendance_user.id
        return Response(payload)
