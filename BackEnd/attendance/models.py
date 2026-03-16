from django.db import models
from django.conf import settings


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
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PRESENT")
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

        total = records.count()
        if total == 0:
            return {"total": 0, "present": 0, "absent": 0, "late": 0, "excused": 0, "percentage": None}

        present = records.filter(status="PRESENT").count()
        absent = records.filter(status="ABSENT").count()
        late = records.filter(status="LATE").count()
        excused = records.filter(status="EXCUSED").count()

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
        records = cls.objects.filter(
            student_id=student_id,
            date=date,
            subject__isnull=False,
        ).select_related("subject", "schedule", "schedule__subject", "schedule__teacher")
        
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
