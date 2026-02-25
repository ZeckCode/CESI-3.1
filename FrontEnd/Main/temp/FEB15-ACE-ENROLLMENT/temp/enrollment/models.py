from django.db import models
from accounts.models import User, Section
from django.utils import timezone


class Enrollment(models.Model):
    """
    Enrollment model tracks which students are enrolled.
    Includes all student info from the enrollment form.
    """

    GRADE_LEVEL_CHOICES = [
        ("prek", "Pre-Kinder"),
        ("kinder", "Kinder"),
        ("grade1", "Grade 1"),
        ("grade2", "Grade 2"),
        ("grade3", "Grade 3"),
        ("grade4", "Grade 4"),
        ("grade5", "Grade 5"),
        ("grade6", "Grade 6"),
    ]

    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("COMPLETED", "Completed"),
        ("DROPPED", "Dropped"),
        ("PENDING", "Pending"),
    ]

    PAYMENT_MODE_CHOICES = [
        ("cash", "Cash"),
        ("installment", "Installment"),
    ]

    STUDENT_TYPE_CHOICES = [
        ("new", "New / Transferee"),
        ("old", "Old Student"),
    ]

    EDUCATION_LEVEL_CHOICES = [
        ("preschool", "Preschool"),
        ("elementary", "Elementary"),
    ]

    # Links
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="enrollments")
    section = models.ForeignKey(Section, on_delete=models.CASCADE, null=True, blank=True, related_name="enrollments")

    # Academic
    grade_level = models.CharField(max_length=20)
    status = models.CharField(max_length=20, default="PENDING")
    academic_year = models.CharField(max_length=10, default="2024-2025")
    student_type = models.CharField(max_length=10, blank=True, null=True)
    education_level = models.CharField(max_length=20, blank=True, null=True)

    # Student Info
    lrn = models.CharField(max_length=20, blank=True, null=True)
    student_number = models.CharField(max_length=20, blank=True, null=True)
    last_name = models.CharField(max_length=50, blank=True, null=True)
    first_name = models.CharField(max_length=50, blank=True, null=True)
    middle_name = models.CharField(max_length=50, blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=10, blank=True, null=True)

    # Contact Info
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    religion = models.CharField(max_length=50, blank=True, null=True)
    telephone_number = models.CharField(max_length=20, blank=True, null=True)
    mobile_number = models.CharField(max_length=20, blank=True, null=True)
    parent_facebook = models.CharField(max_length=100, blank=True, null=True)

    # Payment / Tracking
    payment_mode = models.CharField(max_length=20, blank=True, null=True)
    enrolled_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # REMOVED unique_together to allow multiple public submissions
        ordering = ["-enrolled_at"]
        verbose_name = "Enrollment"
        verbose_name_plural = "Enrollments"

    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.grade_level}"