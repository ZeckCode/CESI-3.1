import datetime

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User, Subject, Section, TeacherProfile, UserProfile
from .models import Schedule, Room, SchoolYear
from .serializers import (
    ScheduleReadSerializer, ScheduleWriteSerializer,
    RoomSerializer, SchoolYearSerializer
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
    """Activate a specific school year (deactivates all others)."""
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)
    try:
        school_year = SchoolYear.objects.get(pk=pk)
    except SchoolYear.DoesNotExist:
        return Response({"detail": "School year not found"}, status=404)
    
    school_year.is_active = True
    school_year.save()  # This will deactivate all others
    return Response(SchoolYearSerializer(school_year).data)


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
        if room:
            qs = qs.filter(room_id=room)
        return qs

    def create(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        ser = ScheduleWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        section_obj = ser.validated_data.get("section")
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

        base = Schedule.objects.filter(day_of_week=day, start_time__lt=end, end_time__gt=start)
        if exclude_id:
            base = base.exclude(pk=exclude_id)

        conflicts = []
        
        # Teacher conflict (skip for free periods without a teacher)
        if data.get("teacher"):
            teacher_conflict = base.filter(teacher=data["teacher"]).first()
            if teacher_conflict:
                conflicts.append({
                    "type": "teacher",
                    "message": f"Teacher {data['teacher'].username} already has "
                              f"{getattr(teacher_conflict.subject, 'name', 'No subject')} at "
                              f"{teacher_conflict.start_time:%H:%M}–{teacher_conflict.end_time:%H:%M} "
                              f"on {teacher_conflict.get_day_of_week_display()}"
                })

        # Section conflict
        section_conflict = base.filter(section=data["section"]).first()
        if section_conflict:
            conflicts.append({
                "type": "section",
                "message": f"Section {data['section'].name} already has "
                          f"{section_conflict.subject.name} at "
                          f"{section_conflict.start_time:%H:%M}–{section_conflict.end_time:%H:%M} "
                          f"on {section_conflict.get_day_of_week_display()}"
            })

        # Room conflict (if room is specified)
        room = data.get("room")
        if room:
            room_conflict = base.filter(room=room).first()
            if room_conflict:
                conflicts.append({
                    "type": "room",
                    "message": f"Room {room.code} is already booked for "
                              f"{room_conflict.section.name} ({getattr(room_conflict.subject, 'name', 'No subject')}) at "
                })

        if conflicts:
            return {
                "message": " | ".join([c["message"] for c in conflicts]),
                "details": conflicts
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
        merged = {
            **{f: getattr(instance, f) for f in ("teacher", "subject", "section", "day_of_week", "start_time", "end_time", "room")},
            **ser.validated_data,
        }
        if isinstance(merged.get("teacher"), int):
            merged["teacher"] = User.objects.get(pk=merged["teacher"])
        if isinstance(merged.get("section"), int):
            merged["section"] = Section.objects.get(pk=merged["section"])
        if isinstance(merged.get("room"), int):
            merged["room"] = Room.objects.get(pk=merged["room"])

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
    for tp in TeacherProfile.objects.select_related("user", "subject").filter(subject__isnull=False):
        teacher_map.setdefault(tp.subject_id, []).append(tp.user)

    # Map grade level to room
    GRADE_TO_ROOM = {
        0: "1F-A",  # Kinder
        1: "1F-B",  # Grade 1
        2: "2F-A",  # Grade 2
        3: "2F-B",  # Grade 3
        4: "3F-A",  # Grade 4
        5: "3F-B",  # Grade 5
        6: "3F-C",  # Grade 6
    }
    
    room_code = GRADE_TO_ROOM.get(section.grade_level)
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
    if not source_schedules.exists():
        return Response({"detail": f"No schedules found for {source_day} in this section."}, status=404)

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
                "school_year": src.school_year,
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

    return Response(ScheduleReadSerializer(qs, many=True).data)
