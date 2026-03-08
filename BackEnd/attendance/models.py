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
        subject = self.schedule.subject.name if self.schedule else "General"
        return f"{self.student.username} - {self.date} - {subject} - {self.status}"

    @classmethod
    def get_student_attendance_stats(cls, student_id, quarter_start, quarter_end, schedule_id=None):
        """
        Calculate attendance stats for a student within a date range.
        Optionally filter by specific schedule (subject).
        Returns dict with counts and percentage.
        """
        records = cls.objects.filter(
            student_id=student_id,
            date__gte=quarter_start,
            date__lte=quarter_end,
        )
        if schedule_id:
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
        ).select_related("schedule", "schedule__subject", "schedule__teacher")
        
        summary = []
        for record in records:
            if record.schedule:
                summary.append({
                    "schedule_id": record.schedule.id,
                    "subject_name": record.schedule.subject.name,
                    "subject_code": record.schedule.subject.code,
                    "start_time": record.schedule.start_time.strftime("%H:%M"),
                    "end_time": record.schedule.end_time.strftime("%H:%M"),
                    "teacher": record.schedule.teacher.username if record.schedule.teacher else None,
                    "status": record.status,
                    "notes": record.notes,
                })
            else:
                # Legacy/homeroom record without schedule
                summary.append({
                    "schedule_id": None,
                    "subject_name": "Homeroom",
                    "subject_code": "HR",
                    "start_time": None,
                    "end_time": None,
                    "teacher": None,
                    "status": record.status,
                    "notes": record.notes,
                })
        return summary
