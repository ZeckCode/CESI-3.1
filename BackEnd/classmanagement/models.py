from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import date


class Room(models.Model):
    """
    School rooms available for scheduling classes.
    """
    code = models.CharField(max_length=20, unique=True)  # e.g., "1F-A", "2F-B"
    name = models.CharField(max_length=100, blank=True)  # e.g., "First Floor Room A"
    capacity = models.PositiveIntegerField(default=40)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code


class SchoolYear(models.Model):
    """
    School year with activation/deactivation feature.
    Only one school year can be active at a time.
    When deactivated, related data becomes read-only.
    """
    name = models.CharField(max_length=50, unique=True)  # e.g., "2025-2026"
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]
        verbose_name_plural = "School Years"

    def __str__(self):
        status = " (Active)" if self.is_active else ""
        return f"{self.name}{status}"

    @property
    def status(self):
        """
        Return status based on current date:
        - 'ONGOING': today is within [start_date, end_date]
        - 'EXPIRED': today is after end_date
        """
        today = date.today()
        if today > self.end_date:
            return 'EXPIRED'
        return 'ONGOING'

    def save(self, *args, **kwargs):
        # If this year is being activated, deactivate all others
        if self.is_active:
            SchoolYear.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class Schedule(models.Model):
    """
    A single timetable entry: one teacher teaches one subject
    in one section on a given day / time-slot.
    """
    DAY_CHOICES = [
        ("MON", "Monday"),
        ("TUE", "Tuesday"),
        ("WED", "Wednesday"),
        ("THU", "Thursday"),
        ("FRI", "Friday"),
    ]

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="schedules",
        limit_choices_to={"role": "TEACHER"},
        null=True,
        blank=True,
    )
    subject = models.ForeignKey(
        "accounts.Subject",
        on_delete=models.CASCADE,
        related_name="schedules",
        null=True,
        blank=True,
    )
    section = models.ForeignKey(
        "accounts.Section",
        on_delete=models.CASCADE,
        related_name="schedules",
    )
    day_of_week = models.CharField(max_length=3, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedules",
    )
    school_year = models.ForeignKey(
        SchoolYear,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="schedules",
    )

    class Meta:
        ordering = ["section", "day_of_week", "start_time"]

    def __str__(self):
        room_str = f" in {self.room.code}" if self.room else ""
        return (
            f"{self.teacher.username} — {self.subject.name} "
            f"@ {self.section.name} ({self.get_day_of_week_display()} "
            f"{self.start_time:%H:%M}–{self.end_time:%H:%M}){room_str}"
        )
