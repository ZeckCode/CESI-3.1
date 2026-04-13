from django.db import models
from django.db.models import Q
from django.conf import settings
from collections import Counter


class AttendanceRecord(models.Model):
    """
    Per-subject attendance record for a student.
    One record per student per date per schedule (subject/period).
    """
    STATUS_CHOICES = [
        ("PRESENT", "Present"),
        ("ABSENT", "Absent"),
        ("LATE", "Late"),
        ("EXCUSED", "Excused"),
    ]
    STATUS_VALUES = [choice[0] for choice in STATUS_CHOICES]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="attendance_records",
        limit_choices_to={"role": "PARENT_STUDENT"},
    )
    section = models.ForeignKey(
        "accounts.Section",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    schedule = models.ForeignKey(
        "classmanagement.Schedule",
        on_delete=models.CASCADE,
        related_name="attendance_records",
        null=True,
        blank=True,
        help_text="The specific class/subject period this attendance is for",
    )
    subject = models.ForeignKey(
        "accounts.Subject",
        on_delete=models.SET_NULL,
        related_name="attendance_records",
        null=True,
        blank=True,
        help_text="Canonical subject snapshot for this attendance record",
    )
    date = models.DateField()
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="PRESENT",
        null=True,
        blank=True,
    )
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="attendance_marked",
        limit_choices_to={"role": "TEACHER"},
    )
    notes = models.TextField(blank=True, default="", help_text="Optional notes (e.g., reason for absence)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Changed to per-subject: student + date + schedule must be unique
        unique_together = ("student", "date", "schedule")
        ordering = ["-date", "student__username", "schedule__start_time"]

    def __str__(self):
        if self.subject:
            subject = self.subject.name
        elif self.schedule and self.schedule.subject:
            subject = self.schedule.subject.name
        else:
            subject = "General"
        return f"{self.student.username} - {self.date} - {subject} - {self.status}"

    @classmethod
    def _dedupe_records(cls, records):
        latest_by_key = {}
        for record in records:
            dedupe_key = (record.date, record.schedule_id, record.subject_id)
            current = latest_by_key.get(dedupe_key)
            if current is None or (record.updated_at, record.id) > (current.updated_at, current.id):
                latest_by_key[dedupe_key] = record
        return list(latest_by_key.values())

    @classmethod
    def get_student_attendance_stats(
        cls,
        student_id,
        quarter_start,
        quarter_end,
        schedule_id=None,
        schedule_ids=None,
        section_id=None,
    ):
        """
        Calculate attendance stats for a student within a date range.
        Optionally filter by a specific schedule, a list of schedules, or a section.
        Returns dict with counts and percentage.
        """
        records = cls.objects.filter(
            student_id=student_id,
            date__gte=quarter_start,
            date__lte=quarter_end,
        )
        if section_id is not None:
            records = records.filter(section_id=section_id)
        if schedule_ids:
            records = records.filter(schedule_id__in=schedule_ids)
        elif schedule_id:
            records = records.filter(schedule_id=schedule_id)

        records = records.filter(status__in=cls.STATUS_VALUES)

        deduped_records = cls._dedupe_records(
            list(records.only("id", "date", "status", "schedule_id", "subject_id", "updated_at"))
        )

        total = len(deduped_records)
        if total == 0:
            return {"total": 0, "present": 0, "absent": 0, "late": 0, "excused": 0, "percentage": None}

        status_counts = Counter(
            record.status for record in deduped_records if record.status in cls.STATUS_VALUES
        )

        present = status_counts.get("PRESENT", 0)
        absent = status_counts.get("ABSENT", 0)
        late = status_counts.get("LATE", 0)
        excused = status_counts.get("EXCUSED", 0)

        # For grade: Present + Late + Excused counts as "attended"
        attended = present + late + excused
        percentage = (attended / total) * 100 if total > 0 else 0

        return {
            "total": total,
            "present": present,
            "absent": absent,
            "late": late,
            "excused": excused,
            "attended": attended,
            "percentage": round(percentage, 2),
        }

    @classmethod
    def get_daily_summary(cls, student_id, date):
        """
        Get all attendance records for a student on a specific date.
        Returns a summary of attendance per subject/period.
        """
        records_qs = cls.objects.filter(
            student_id=student_id,
            date=date,
        ).filter(
            Q(subject__isnull=False) | Q(schedule__isnull=False)
        ).filter(
            status__in=cls.STATUS_VALUES,
        ).select_related("subject", "schedule", "schedule__subject", "schedule__teacher")

        records = cls._dedupe_records(
            list(records_qs.order_by("schedule__start_time", "-updated_at", "-id"))
        )
        
        summary = []
        for record in records:
            subject_name = None
            subject_code = None

            if record.subject:
                subject_name = record.subject.name
                subject_code = record.subject.code
            elif record.schedule and record.schedule.subject:
                subject_name = record.schedule.subject.name
                subject_code = record.schedule.subject.code

            if record.schedule:
                summary.append({
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
                summary.append({
                    "schedule_id": None,
                    "subject_name": subject_name or "Homeroom",
                    "subject_code": subject_code or "HR",
                    "start_time": None,
                    "end_time": None,
                    "teacher": None,
                    "status": record.status,
                    "notes": record.notes,
                })
        return summary
