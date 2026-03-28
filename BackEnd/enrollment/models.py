# enrollment/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone
from accounts.models import Section
import os
from io import BytesIO

try:
    from PIL import Image
except Exception:
    Image = None


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
        ("PENDING", "Pending"),
        ("ACTIVE", "Active"),
        ("COMPLETED", "Completed"),
        ("DROPPED", "Dropped"),
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

    parent_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="parent_enrollments",
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )

    section = models.ForeignKey(
        Section,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="enrollments",
    )

    # Academic
    grade_level = models.CharField(max_length=20, choices=GRADE_LEVEL_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    academic_year = models.CharField(max_length=10, default="2024-2025")

    student_type = models.CharField(
        max_length=10,
        choices=STUDENT_TYPE_CHOICES,
        blank=True,
        null=True,
    )
    education_level = models.CharField(
        max_length=20,
        choices=EDUCATION_LEVEL_CHOICES,
        blank=True,
        null=True,
    )

    # Student Info
    lrn = models.CharField(max_length=20, blank=True, null=True)
    student_number = models.CharField(max_length=20, blank=True, null=True, unique=True)
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

    # Image
    id_image = models.ImageField(upload_to="enrollment_ids/", blank=True, null=True)
    # Optional DB-backed compressed image
    id_image_data = models.BinaryField(null=True, blank=True, editable=False)
    id_image_mime = models.CharField(max_length=50, blank=True, null=True, editable=False)
    id_image_filename = models.CharField(max_length=255, blank=True, null=True, editable=False)

    # Payment / Tracking
    payment_mode = models.CharField(
        max_length=20,
        choices=PAYMENT_MODE_CHOICES,
        blank=True,
        null=True,
    )
    enrolled_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-enrolled_at"]
        verbose_name = "Enrollment"
        verbose_name_plural = "Enrollments"

    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.grade_level}"

    def save(self, *args, **kwargs):
        # Avoid recursive double-save
        if getattr(self, "_saving_binary", False):
            return super().save(*args, **kwargs)

        computed = False
        # Compress id_image to WebP and store in DB fields when Pillow available
        if self.id_image and Image is not None:
            try:
                try:
                    self.id_image.open()
                except Exception:
                    pass

                img = Image.open(self.id_image)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")

                max_width = 1600
                if getattr(img, "width", None) and img.width > max_width:
                    ratio = max_width / float(img.width)
                    new_height = int(float(img.height) * ratio)
                    img = img.resize((max_width, new_height), Image.ANTIALIAS)

                output = BytesIO()
                img.save(output, format="WEBP", quality=80)
                output.seek(0)
                self.id_image_data = output.read()
                self.id_image_mime = "image/webp"
                self.id_image_filename = os.path.basename(self.id_image.name)
                computed = True
            except Exception:
                # don't block save on compression errors
                pass

        update_fields = kwargs.get("update_fields", None)
        super().save(*args, **kwargs)

        if computed:
            binary_fields = ["id_image_data", "id_image_mime", "id_image_filename"]
            try:
                self._saving_binary = True
                if update_fields:
                    new_update = set(update_fields) | set(binary_fields)
                    super().save(update_fields=list(new_update))
                else:
                    super().save(update_fields=binary_fields)
            finally:
                self._saving_binary = False


class ParentInfo(models.Model):
    enrollment = models.OneToOneField(
        Enrollment,
        on_delete=models.CASCADE,
        related_name="parent_info",
    )

    father_name = models.CharField(max_length=100, blank=True, null=True)
    father_contact = models.CharField(max_length=20, blank=True, null=True)
    father_occupation = models.CharField(max_length=100, blank=True, null=True)

    mother_name = models.CharField(max_length=100, blank=True, null=True)
    mother_contact = models.CharField(max_length=20, blank=True, null=True)
    mother_occupation = models.CharField(max_length=100, blank=True, null=True)

    guardian_name = models.CharField(max_length=100, blank=True, null=True)
    guardian_contact = models.CharField(max_length=20, blank=True, null=True)
    guardian_relationship = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"Parent Info - {self.enrollment}"


class EnrollmentSettings(models.Model):
    """
    Singleton model — only ONE row ever exists (pk=1).
    Controls the enrollment window and current school year.
    """
    open_date = models.DateField(
        null=True,
        blank=True,
        help_text="Enrollment window start date. Leave blank to use auto default (June 1)."
    )

    window_days = models.PositiveIntegerField(
        default=7,
        help_text="Number of days the enrollment form is open."
    )

    academic_year = models.CharField(
        max_length=9,
        null=True,
        blank=True,
        help_text="Current academic year, e.g. 2025-2026. Leave blank to auto-calculate."
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Enrollment Settings"
        verbose_name_plural = "Enrollment Settings"

    def __str__(self):
        return f"Enrollment Settings (AY {self.academic_year or 'auto'}, opens {self.open_date or 'auto'})"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
    
class EnrollmentDocument(models.Model):
    DOCUMENT_TYPE_CHOICES = [
            ("form_137", "Form 137-E"),
            ("sf10", "School Form 10 (SF10)"),
            ("birth_certificate", "Birth Certificate"),
            ("good_moral", "Good Moral Certificate"),
            ("report_card", "Report Card"),
            ("other", "Other"),
        ]

    enrollment = models.ForeignKey(
            Enrollment,
            on_delete=models.CASCADE,
            related_name="documents",
        )
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    file = models.FileField(upload_to="enrollment_documents/")
    label = models.CharField(max_length=100, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at"]

    def __str__(self):
        return f"{self.enrollment} - {self.document_type}"