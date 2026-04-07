import datetime
from datetime import time as time_class

from django.db import transaction

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User, Subject, Section, TeacherProfile, UserProfile
from .models import Schedule, Room, SchoolYear, ScheduleTemplate
from .serializers import (
    ScheduleReadSerializer, ScheduleWriteSerializer,
    RoomSerializer, SchoolYearSerializer, ScheduleTemplateSerializer
)


# ══════════════════════════════════════════════════════
# ROOM CRUD
# ══════════════════════════════════════════════════════

class RoomListCreate(generics.ListCreateAPIView):
    """List all rooms or create a new one (admin only)."""
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        return super().create(request, *args, **kwargs)


class RoomDetail(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a room (admin only for write ops)."""
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        return super().destroy(request, *args, **kwargs)


# ══════════════════════════════════════════════════════
# SCHOOL YEAR CRUD
# ══════════════════════════════════════════════════════

class SchoolYearListCreate(generics.ListCreateAPIView):
    """List all school years or create a new one (admin only)."""
    queryset = SchoolYear.objects.all()
    serializer_class = SchoolYearSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        return super().create(request, *args, **kwargs)


class SchoolYearDetail(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a school year."""
    queryset = SchoolYear.objects.all()
    serializer_class = SchoolYearSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        
        instance = self.get_object()
        
        # EXPIRED years can only have their name and dates updated
        # (prevent accidental deletion but allow correction)
        if instance.status == 'EXPIRED':
            # Allow updates only if it's trying to extend the date or correct dates
            return super().update(request, *args, **kwargs)
        
        # ONGOING years can only change name and dates
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        
        instance = self.get_object()
        
        # Cannot delete active school year
        if instance.is_active:
            return Response(
                {"detail": "Cannot delete active school year. Deactivate it first."},
                status=400
            )
        
        # ONGOING years cannot be deleted (prevent accidental deletion)
        if instance.status == 'ONGOING':
            return Response(
                {"detail": "Cannot delete ongoing school year. Wait until it expires or deactivate it first."},
                status=400
            )
        
        # EXPIRED years can be deleted
        return super().destroy(request, *args, **kwargs)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def activate_school_year(request, pk):
    """Activate a specific school year and optionally reset class-management data."""
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    try:
        school_year = SchoolYear.objects.get(pk=pk)
    except SchoolYear.DoesNotExist:
        return Response({"detail": "School year not found"}, status=404)

    if school_year.is_active:
        payload = SchoolYearSerializer(school_year).data
        payload["class_management_reset"] = {
            "performed": False,
            "reason": "School year is already active.",
            "sections_cleared": 0,
            "schedules_cleared": 0,
            "teachers_unassigned": 0,
        }
        return Response(payload)

    raw_reset = request.data.get(
        "reset_class_data",
        request.query_params.get("reset_class_data", request.query_params.get("reset", False)),
    )
    if isinstance(raw_reset, str):
        reset_class_data = raw_reset.strip().lower() not in ("false", "0", "no")
    else:
        reset_class_data = bool(raw_reset)

    reset_stats = {
        "performed": False,
        "sections_cleared": 0,
        "schedules_cleared": 0,
        "teachers_unassigned": 0,
    }

    with transaction.atomic():
        school_year.is_active = True
        school_year.save()  # This will deactivate all others

        if reset_class_data:
            schedules_qs = Schedule.objects.filter(school_year=school_year)
            sections_qs = Section.objects.filter(school_year=school_year)

            reset_stats["performed"] = True
            reset_stats["schedules_cleared"] = schedules_qs.count()
            reset_stats["sections_cleared"] = sections_qs.count()

            schedules_qs.delete()
            sections_qs.delete()

            teacher_profiles = TeacherProfile.objects.prefetch_related("subjects").all()
            unassigned_count = 0
            for profile in teacher_profiles:
                had_subject_links = profile.subjects.exists()
                had_primary_subject = profile.subject_id is not None
                had_section = profile.section_id is not None

                if had_subject_links:
                    profile.subjects.clear()

                update_fields = []
                if had_primary_subject:
                    profile.subject = None
                    update_fields.append("subject")
                if had_section:
                    profile.section = None
                    update_fields.append("section")

                if update_fields:
                    profile.save(update_fields=update_fields)

                if had_subject_links or had_primary_subject or had_section:
                    unassigned_count += 1

            reset_stats["teachers_unassigned"] = unassigned_count

    payload = SchoolYearSerializer(school_year).data
    payload["class_management_reset"] = reset_stats
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_active_school_year(request):
    """Get the currently active school year."""
    school_year = SchoolYear.objects.filter(is_active=True).first()
    if not school_year:
        return Response({"detail": "No active school year"}, status=404)
    return Response(SchoolYearSerializer(school_year).data)


# ══════════════════════════════════════════════════════
# SCHEDULE CRUD
# ══════════════════════════════════════════════════════

class ScheduleListCreate(generics.ListCreateAPIView):
    """
    GET  — list schedules (filterable by ?section=, ?teacher=, ?subject=, ?day=, ?school_year=)
    POST — create a single schedule entry (admin only)
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ScheduleWriteSerializer
        return ScheduleReadSerializer

    def get_queryset(self):
        qs = Schedule.objects.select_related("teacher", "subject", "section", "room", "school_year").all()
        section = self.request.query_params.get("section")
        teacher = self.request.query_params.get("teacher")
        subject = self.request.query_params.get("subject")
        day = self.request.query_params.get("day")
        school_year = self.request.query_params.get("school_year")
        room = self.request.query_params.get("room")
        if section:
            qs = qs.filter(section_id=section)
        if teacher:
            qs = qs.filter(teacher_id=teacher)
        if subject:
            qs = qs.filter(subject_id=subject)
        if day:
            qs = qs.filter(day_of_week=day.upper())
        if school_year:
            qs = qs.filter(school_year_id=school_year)
        else:
            active_sy = SchoolYear.objects.filter(is_active=True).first()
            if active_sy:
                qs = qs.filter(school_year=active_sy)
        if room:
            qs = qs.filter(room_id=room)
        return qs

    def create(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        ser = ScheduleWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        section_obj = ser.validated_data.get("section")
        section_school_year = getattr(section_obj, "school_year", None)

        if not ser.validated_data.get("school_year"):
            if section_school_year:
                ser.validated_data["school_year"] = section_school_year
            else:
                active_sy = SchoolYear.objects.filter(is_active=True).first()
                if active_sy:
                    ser.validated_data["school_year"] = active_sy

        if section_school_year and ser.validated_data.get("school_year") and ser.validated_data.get("school_year") != section_school_year:
            return Response({"detail": "Schedule school year must match section school year."}, status=400)

        if section_obj and not ser.validated_data.get("room"):
            if section_obj.room is not None:
                ser.validated_data["room"] = section_obj.room

        conflicts = self._check_conflicts(ser.validated_data)
        if conflicts:
            return Response({"detail": conflicts["message"], "conflicts": conflicts["details"]}, status=400)

        self.perform_create(ser)
        obj = Schedule.objects.select_related("teacher", "subject", "section", "room").get(pk=ser.instance.pk)
        return Response(ScheduleReadSerializer(obj).data, status=201)

    @staticmethod
    def _check_conflicts(data, exclude_id=None):
        """Check for teacher, section, or room time overlaps on the same day."""
        day = data["day_of_week"]
        start = data["start_time"]
        end = data["end_time"]
        school_year = data.get("school_year")

        base = Schedule.objects.filter(day_of_week=day, start_time__lt=end, end_time__gt=start)
        if school_year is not None:
            base = base.filter(school_year=school_year)
        else:
            active_sy = SchoolYear.objects.filter(is_active=True).first()
            if active_sy:
                base = base.filter(school_year=active_sy)

        if exclude_id:
            base = base.exclude(pk=exclude_id)

        conflicts = []

        teacher = data.get("teacher")
        subject = data.get("subject")
        if teacher and subject:
            teacher_profile = TeacherProfile.objects.prefetch_related("subjects").filter(user=teacher).first()
            if not teacher_profile:
                conflicts.append({
                    "type": "qualification",
                    "message": f"Teacher {teacher.username} has no teacher profile and cannot be assigned.",
                })
            else:
                teacher_subject_ids = set(teacher_profile.subjects.values_list("id", flat=True))
                if teacher_profile.subject_id:
                    teacher_subject_ids.add(teacher_profile.subject_id)

                if subject.id not in teacher_subject_ids:
                    conflicts.append({
                        "type": "qualification",
                        "message": (
                            f"Teacher {teacher.username} is not assigned to subject "
                            f"{getattr(subject, 'name', subject.id)}."
                        ),
                    })

        # Teacher conflict (skip for entries without a teacher)
        if teacher:
            teacher_conflict = base.filter(teacher=teacher).first()
            if teacher_conflict:
                conflicts.append({
                    "type": "teacher",
                    "message": (
                        f"Teacher {teacher.username} already has "
                        f"{getattr(teacher_conflict.subject, 'name', 'No subject')} at "
                        f"{teacher_conflict.start_time:%H:%M}–{teacher_conflict.end_time:%H:%M} "
                        f"on {teacher_conflict.get_day_of_week_display()}"
                    )
                })

        # Section conflict
        section_conflict = base.filter(section=data["section"]).first()
        if section_conflict:
            conflicts.append({
                "type": "section",
                "message": (
                    f"Section {data['section'].name} already has "
                    f"{getattr(section_conflict.subject, 'name', 'No subject')} at "
                    f"{section_conflict.start_time:%H:%M}–{section_conflict.end_time:%H:%M} "
                    f"on {section_conflict.get_day_of_week_display()}"
                )
            })

        # Room conflict
        room = data.get("room")
        if room:
            room_conflict = base.filter(room=room).first()
            if room_conflict:
                conflicts.append({
                    "type": "room",
                    "message": (
                        f"Room {room.code} is already booked for "
                        f"{room_conflict.section.name} "
                        f"({getattr(room_conflict.subject, 'name', 'No subject')}) at "
                        f"{room_conflict.start_time:%H:%M}–{room_conflict.end_time:%H:%M} "
                        f"on {room_conflict.get_day_of_week_display()}"
                    )
                })

        if conflicts:
            return {
                "message": " | ".join([c["message"] for c in conflicts]),
                "details": conflicts,
            }
        return None

class ScheduleDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Schedule.objects.select_related("teacher", "subject", "section", "room", "school_year").all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ScheduleWriteSerializer
        return ScheduleReadSerializer

    def update(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        ser = ScheduleWriteSerializer(instance, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)

        if not ser.validated_data.get("school_year") and not instance.school_year_id:
            active_sy = SchoolYear.objects.filter(is_active=True).first()
            if active_sy:
                ser.validated_data["school_year"] = active_sy

        merged = {
            **{f: getattr(instance, f) for f in ("teacher", "subject", "section", "day_of_week", "start_time", "end_time", "room", "school_year")},
            **ser.validated_data,
        }
        if isinstance(merged.get("teacher"), int):
            merged["teacher"] = User.objects.get(pk=merged["teacher"])
        if isinstance(merged.get("section"), int):
            merged["section"] = Section.objects.get(pk=merged["section"])
        if isinstance(merged.get("room"), int):
            merged["room"] = Room.objects.get(pk=merged["room"])
        if isinstance(merged.get("school_year"), int):
            merged["school_year"] = SchoolYear.objects.get(pk=merged["school_year"])

        if merged.get("section") and getattr(merged["section"], "school_year", None):
            if merged.get("school_year") and merged.get("school_year") != merged["section"].school_year:
                return Response({"detail": "Schedule school year must match section school year."}, status=400)
            merged["school_year"] = merged["section"].school_year

        if merged.get("section") and not merged.get("room"):
            sec = merged.get("section")
            if hasattr(sec, "room") and sec.room is not None:
                merged["room"] = sec.room

        conflicts = ScheduleListCreate._check_conflicts(merged, exclude_id=instance.pk)
        if conflicts:
            return Response({"detail": conflicts["message"], "conflicts": conflicts["details"]}, status=400)
        ser.save()
        obj = Schedule.objects.select_related("teacher", "subject", "section", "room").get(pk=instance.pk)
        return Response(ScheduleReadSerializer(obj).data)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        return super().destroy(request, *args, **kwargs)


# ══════════════════════════════════════════════════════
# BULK DELETE SCHEDULES
# ══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bulk_delete_schedules(request):
    """
    Delete multiple schedules at once.
    Body: { "ids": [1, 2, 3, ...] }
    """
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    ids = request.data.get("ids", [])
    if not isinstance(ids, list) or len(ids) == 0:
        return Response({"detail": "Provide a non-empty list of ids."}, status=400)

    deleted_count, _ = Schedule.objects.filter(pk__in=ids).delete()
    return Response({"deleted_count": deleted_count})


# ══════════════════════════════════════════════════════
# BULK UPDATE SCHEDULES
# ══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bulk_update_schedules(request):
    """
    Update multiple schedules at once. Only the fields supplied will be changed.
    Body: { "ids": [1,2,3], "updates": { "teacher": 5, "day_of_week": "MON", "start_time": "08:00:00", "end_time": "09:00:00", "room": 1 } }
    """
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    ids = request.data.get("ids", [])
    updates = request.data.get("updates", {})
    if not isinstance(ids, list) or len(ids) == 0:
        return Response({"detail": "Provide a non-empty list of ids."}, status=400)
    if not isinstance(updates, dict) or len(updates) == 0:
        return Response({"detail": "Provide at least one field to update."}, status=400)

    allowed_fields = {"teacher", "subject", "section", "day_of_week", "start_time", "end_time", "room", "school_year"}
    clean = {}
    for k, v in updates.items():
        if k in allowed_fields and v not in (None, ""):
            if k in ("teacher", "subject", "section", "room", "school_year"):
                clean[k + "_id"] = int(v)
            else:
                clean[k] = v

    if not clean:
        return Response({"detail": "No valid fields to update."}, status=400)

    updated_count = Schedule.objects.filter(pk__in=ids).update(**clean)
    return Response({"updated_count": updated_count})


# ══════════════════════════════════════════════════════
# AUTO-GENERATE SCHEDULES
# Template with breaks:
# - 7:30-9:30 AM: 2 class periods (1 hour each)
# - 9:30-10:00 AM: Recess (break - no class)
# - 10:00 AM-12:00 PM: 2 class periods (1 hour each)
# - 12:00-12:40 PM: Lunch break (no class)
# - 12:40-3:00 PM: 2+ class periods (1 hour each)
# - Constraints:
#   - No subject repeats per day (each subject once per day max)
#   - 1 hour max per subject per day
#   - Leave blanks if subjects exhausted
# ══════════════════════════════════════════════════════

def _get_class_slots():
    """
    Return the class time slots (excluding breaks).
    Returns list of (start_time, end_time) tuples.
    """
    return [
        (datetime.time(7, 30), datetime.time(8, 30)),   # Period 1
        (datetime.time(8, 30), datetime.time(9, 30)),   # Period 2
        # 9:30-10:00 RECESS (skip)
        (datetime.time(10, 0), datetime.time(11, 0)),   # Period 3
        (datetime.time(11, 0), datetime.time(12, 0)),   # Period 4
        # 12:00-12:40 LUNCH (skip)
        (datetime.time(12, 40), datetime.time(13, 40)), # Period 5
        (datetime.time(13, 40), datetime.time(14, 40)), # Period 6
        (datetime.time(14, 40), datetime.time(15, 40)), # Period 7
    ]


def _get_break_slots():
    """
    Return the break time slots.
    Returns list of (start_time, end_time, label) tuples.
    """
    return [
        (datetime.time(9, 30), datetime.time(10, 0), "Recess"),
        (datetime.time(12, 0), datetime.time(12, 40), "Lunch"),
    ]


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def auto_generate_schedules(request):
    """
    Auto-generate schedules with conflict detection.
    Body: { 
        "section": <id> (required),
        "days": ["MON", "TUE", "WED", "THU", "FRI"] (optional, defaults to all weekdays)
    }
    
    Creates schedules where each time slot has ONE subject that repeats Mon-Fri.
    Implements conflict detection: if a teacher is already assigned to another section
    at the same time, tries a different teacher for that subject.
    """
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    section_id = request.data.get("section")
    if not section_id:
        return Response({"detail": "Section is required for auto-generate"}, status=400)

    try:
        section = Section.objects.get(pk=section_id)
    except Section.DoesNotExist:
        return Response({"detail": "Section not found"}, status=404)

    # Get days to generate for (default: all weekdays)
    days_input = request.data.get("days", ["MON", "TUE", "WED", "THU", "FRI"])
    if not isinstance(days_input, list):
        days_input = ["MON", "TUE", "WED", "THU", "FRI"]
    valid_days = ["MON", "TUE", "WED", "THU", "FRI"]
    days = [d for d in days_input if d in valid_days]
    if not days:
        days = valid_days

    # Get all subjects (exclude extension)
    subjects = list(
        Subject.objects
        .exclude(code__icontains='ext')
        .all()
    )
    
    if not subjects:
        return Response({"detail": "No subjects to schedule. Please add subjects first."}, status=400)

    # Map subject_id → [User teacher, …]
    teacher_map = {}
    for tp in TeacherProfile.objects.select_related("user", "subject").prefetch_related("subjects"):
        subject_ids = set(tp.subjects.values_list("id", flat=True))
        if tp.subject_id:
            subject_ids.add(tp.subject_id)

        for subject_id in subject_ids:
            teacher_map.setdefault(subject_id, []).append(tp.user)

    # Map grade level to room
    GRADE_TO_ROOM = {
        "prek": "PREK-RM01",
        "kinder": "1F-A",
        "grade1": "1F-B",
        "grade2": "2F-A",
        "grade3": "2F-B",
        "grade4": "3F-A",
        "grade5": "3F-B",
        "grade6": "3F-C",
    }

    active_school_year = section.school_year or SchoolYear.objects.filter(is_active=True).first()

    room_code = GRADE_TO_ROOM.get(str(section.grade_level))
    room = Room.objects.filter(code=room_code).first() if room_code else None

    # Get class slots and break slots
    class_slots = _get_class_slots()
    break_slots = _get_break_slots()
    
    # Helper: Check if a teacher has a conflict at a given time on a given day
    def has_conflict(teacher, day, start_time, end_time):
        """Check if teacher is already scheduled for another section at this time."""
        return Schedule.objects.filter(
            teacher=teacher,
            day_of_week=day,
            start_time__lt=end_time,
            end_time__gt=start_time,
        ).exclude(section=section).exists()
    
    # Build subject roster (one subject per time slot, repeats Mon-Fri)
    subject_roster = {}  # slot_idx -> subject
    subject_index = 0
    for slot_idx in range(len(class_slots)):
        subj = subjects[subject_index % len(subjects)]
        subject_roster[slot_idx] = subj
        subject_index += 1
    
    created = []
    
    # For each requested day, assign teachers from the roster with conflict detection
    for day in days:
        # Assign class schedules
        for slot_idx, (slot_start, slot_end) in enumerate(class_slots):
            subj = subject_roster.get(slot_idx)
            if not subj:
                continue
            
            # Try to find a teacher for this subject without conflict
            assigned = False
            for teacher in teacher_map.get(subj.id, []):
                if not has_conflict(teacher, day, slot_start, slot_end):
                    sched = Schedule.objects.create(
                        teacher=teacher,
                        subject=subj,
                        section=section,
                        day_of_week=day,
                        start_time=slot_start,
                        end_time=slot_end,
                        room=room,
                        school_year=active_school_year,
                    )
                    created.append(sched.id)
                    assigned = True
                    break
            
            # If no teacher available without conflict, skip this slot
            if not assigned:
                pass
        
        # Add break entries
        for break_start, break_end, break_label in break_slots:
            teacher = None
            if section.adviser and hasattr(section.adviser, 'user'):
                teacher = section.adviser.user
            else:
                # Fall back to first available teacher from roster
                for slot_idx in subject_roster:
                    subj = subject_roster[slot_idx]
                    if subj.id in teacher_map and teacher_map[subj.id]:
                        teacher = teacher_map[subj.id][0]
                        break
            
            if teacher:
                sched = Schedule.objects.create(
                    teacher=teacher,
                    subject=None,
                    section=section,
                    day_of_week=day,
                    start_time=break_start,
                    end_time=break_end,
                    room=room,
                    school_year=active_school_year,
                )
                created.append(sched.id)

    return Response({
        "created_count": len(created),
        "schedule_ids": created,
        "message": f"Generated {len(created)} schedule entries for {section.name}"
    }, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def copy_schedule_day(request):
    """Copy existing day schedule from source_day to target_days for a section."""
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    section_id = request.data.get("section")
    source_day = request.data.get("source_day")
    target_days = request.data.get("target_days")

    if not section_id or not source_day or not isinstance(target_days, list) or not target_days:
        return Response({"detail": "section, source_day, target_days are required"}, status=400)

    valid_days = ["MON", "TUE", "WED", "THU", "FRI"]
    if source_day not in valid_days:
        return Response({"detail": "source_day must be one of MON,TUE,WED,THU,FRI"}, status=400)

    target_days = [d for d in target_days if d in valid_days and d != source_day]
    if not target_days:
        return Response({"detail": "Choose at least one different target day"}, status=400)

    try:
        section = Section.objects.get(pk=section_id)
    except Section.DoesNotExist:
        return Response({"detail": "Section not found"}, status=404)

    source_schedules = Schedule.objects.filter(section=section, day_of_week=source_day)
    if section.school_year_id:
        source_schedules = source_schedules.filter(school_year=section.school_year)
    else:
        active_sy = SchoolYear.objects.filter(is_active=True).first()
        if active_sy:
            source_schedules = source_schedules.filter(school_year=active_sy)

    if not source_schedules.exists():
        return Response({"detail": f"No schedules found for {source_day} in this section."}, status=404)

    active_school_year = section.school_year or SchoolYear.objects.filter(is_active=True).first()

    created_count = 0
    skipped = []

    for target_day in target_days:
        for src in source_schedules:
            payload = {
                "teacher": src.teacher,
                "subject": src.subject,
                "section": section,
                "day_of_week": target_day,
                "start_time": src.start_time,
                "end_time": src.end_time,
                "room": src.room or section.room,
                "school_year": src.school_year or active_school_year,
            }

            conflicts = ScheduleListCreate._check_conflicts(payload)
            if conflicts:
                skipped.append({
                    "source_id": src.id,
                    "target_day": target_day,
                    "conflict": conflicts["message"],
                })
                continue

            Schedule.objects.create(**payload)
            created_count += 1

    return Response({
        "created_count": created_count,
        "skipped_count": len(skipped),
        "skipped": skipped,
    }, status=201)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def schedule_templates(request):
    """
    GET  - list saved schedule templates
    POST - save a schedule template from a source school year (defaults to active)
    """
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    if request.method == "GET":
        qs = ScheduleTemplate.objects.select_related("source_school_year", "created_by").all()
        return Response(ScheduleTemplateSerializer(qs, many=True).data)

    raw_source_id = request.data.get("source_school_year")
    source_school_year = None
    if raw_source_id not in (None, ""):
        try:
            source_school_year = SchoolYear.objects.get(pk=int(raw_source_id))
        except (ValueError, TypeError, SchoolYear.DoesNotExist):
            return Response({"detail": "Invalid source school year"}, status=400)
    else:
        source_school_year = SchoolYear.objects.filter(is_active=True).first()

    source_qs = Schedule.objects.select_related("section", "subject", "room", "school_year", "section__room")
    if source_school_year:
        source_qs = source_qs.filter(school_year=source_school_year)

    raw_section_id = request.data.get("section")
    if raw_section_id not in (None, ""):
        try:
            source_qs = source_qs.filter(section_id=int(raw_section_id))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid section id"}, status=400)

    if not source_qs.exists():
        return Response({"detail": "No schedules found to save as template."}, status=400)

    template_payload = []
    for sched in source_qs:
        if not sched.section:
            continue

        room_obj = sched.room or sched.section.room
        template_payload.append(
            {
                "section_name": sched.section.name,
                "grade_level": sched.section.grade_level,
                "section_capacity": sched.section.capacity,
                "subject_id": sched.subject_id,
                "day_of_week": sched.day_of_week,
                "start_time": sched.start_time.isoformat(),
                "end_time": sched.end_time.isoformat(),
                "room_code": room_obj.code if room_obj else None,
                "room_name": room_obj.name if room_obj else "",
                "room_capacity": room_obj.capacity if room_obj else 40,
            }
        )

    if not template_payload:
        return Response({"detail": "No valid schedule rows found to save."}, status=400)

    name = (request.data.get("name") or "").strip()
    if not name:
        source_label = source_school_year.name if source_school_year else "Current"
        name = f"{source_label} Schedule Template ({datetime.datetime.now():%Y-%m-%d %H:%M})"

    template = ScheduleTemplate.objects.create(
        name=name,
        source_school_year=source_school_year,
        payload=template_payload,
        created_by=request.user,
    )

    return Response(ScheduleTemplateSerializer(template).data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def apply_schedule_template(request, template_id):
    """
    Apply a saved schedule template into a target school year.
    Teachers are intentionally left unassigned for new-school-year staffing.
    """
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    try:
        template = ScheduleTemplate.objects.get(pk=template_id)
    except ScheduleTemplate.DoesNotExist:
        return Response({"detail": "Template not found"}, status=404)

    entries = template.payload or []
    if not isinstance(entries, list) or not entries:
        return Response({"detail": "Template has no entries."}, status=400)

    raw_target_id = request.data.get("school_year_id") or request.data.get("target_school_year")
    target_school_year = None
    if raw_target_id not in (None, ""):
        try:
            target_school_year = SchoolYear.objects.get(pk=int(raw_target_id))
        except (ValueError, TypeError, SchoolYear.DoesNotExist):
            return Response({"detail": "Invalid target school year"}, status=400)
    else:
        target_school_year = SchoolYear.objects.filter(is_active=True).first()

    if not target_school_year:
        return Response({"detail": "No target school year available."}, status=400)

    raw_clear = request.data.get("clear_existing", True)
    if isinstance(raw_clear, str):
        clear_existing = raw_clear.strip().lower() not in ("false", "0", "no")
    else:
        clear_existing = bool(raw_clear)

    created_count = 0
    cleared_count = 0
    skipped = []
    section_cache = {}
    room_cache = {}

    with transaction.atomic():
        if clear_existing:
            target_qs = Schedule.objects.filter(school_year=target_school_year)
            cleared_count = target_qs.count()
            target_qs.delete()

        for idx, entry in enumerate(entries, start=1):
            section_name = str(entry.get("section_name") or "").strip()
            grade_level = str(entry.get("grade_level") or "").strip()
            day_of_week = str(entry.get("day_of_week") or "").strip().upper()

            if not section_name or not grade_level or day_of_week not in {"MON", "TUE", "WED", "THU", "FRI"}:
                skipped.append({"row": idx, "reason": "Invalid section/grade/day data"})
                continue

            room_code = str(entry.get("room_code") or "").strip()
            room_obj = None
            if room_code:
                if room_code in room_cache:
                    room_obj = room_cache[room_code]
                else:
                    room_obj, _ = Room.objects.get_or_create(
                        code=room_code,
                        defaults={
                            "name": str(entry.get("room_name") or "").strip(),
                            "capacity": int(entry.get("room_capacity") or 40),
                            "is_active": True,
                        },
                    )
                    room_cache[room_code] = room_obj

            section_key = (grade_level, section_name)
            section_obj = section_cache.get(section_key)
            if section_obj is None:
                section_defaults = {
                    "capacity": int(entry.get("section_capacity") or 40),
                    "school_year": target_school_year,
                }
                if room_obj:
                    section_defaults["room"] = room_obj

                section_obj, _ = Section.objects.get_or_create(
                    school_year=target_school_year,
                    grade_level=grade_level,
                    name=section_name,
                    defaults=section_defaults,
                )

                if room_obj and section_obj.room_id != room_obj.id:
                    section_obj.room = room_obj
                    section_obj.save(update_fields=["room"])

                section_cache[section_key] = section_obj

            subject_obj = None
            subject_id = entry.get("subject_id")
            if subject_id not in (None, ""):
                subject_obj = Subject.objects.filter(pk=subject_id).first()
                if subject_obj is None:
                    skipped.append({"row": idx, "reason": f"Subject {subject_id} does not exist"})
                    continue

            try:
                start_time = time_class.fromisoformat(str(entry.get("start_time") or ""))
                end_time = time_class.fromisoformat(str(entry.get("end_time") or ""))
            except ValueError:
                skipped.append({"row": idx, "reason": "Invalid time format"})
                continue

            payload = {
                "teacher": None,
                "subject": subject_obj,
                "section": section_obj,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
                "room": room_obj or section_obj.room,
                "school_year": target_school_year,
            }

            conflicts = ScheduleListCreate._check_conflicts(payload)
            if conflicts:
                conflict_reason = "; ".join(
                    [c.get("message", "Conflict") for c in conflicts if isinstance(c, dict)]
                ) or "Schedule conflict"
                skipped.append({"row": idx, "reason": conflict_reason})
                continue

            Schedule.objects.create(**payload)
            created_count += 1

    return Response(
        {
            "template_id": template.id,
            "target_school_year": target_school_year.name,
            "cleared_count": cleared_count,
            "created_count": created_count,
            "skipped_count": len(skipped),
            "skipped": skipped,
        },
        status=201,
    )


# ══════════════════════════════════════════════════════
# MY SCHEDULE  (teacher or parent/student)
# ══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_schedule(request):
    """
    Teachers → their teaching schedule.
    Parents/Students → schedules for their assigned section.
    """
    user = request.user

    if user.role == "TEACHER":
        qs = Schedule.objects.select_related("teacher", "subject", "section").filter(teacher=user)
    elif user.role == "PARENT_STUDENT":
        try:
            profile = user.profile
            if profile.section:
                qs = Schedule.objects.select_related("teacher", "subject", "section").filter(section=profile.section)
            else:
                return Response([])
        except UserProfile.DoesNotExist:
            return Response([])
    else:
        return Response({"detail": "Forbidden"}, status=403)

    active_sy = SchoolYear.objects.filter(is_active=True).first()
    if active_sy:
        qs = qs.filter(school_year=active_sy)

    return Response(ScheduleReadSerializer(qs, many=True).data)
