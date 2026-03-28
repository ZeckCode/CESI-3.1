import os
from io import BytesIO
from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

try:
    from PIL import Image
except Exception:
    Image = None

User = get_user_model()

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_VIDEO_EXTS = {".mp4", ".webm", ".ogg", ".mov"}  # browser-friendly

def validate_media_file_extension(value):
    ext = os.path.splitext(value.name)[1].lower()
    if ext not in (ALLOWED_IMAGE_EXTS | ALLOWED_VIDEO_EXTS):
        raise ValidationError(
            f"Unsupported file type: {ext}. "
            f"Allowed images: {', '.join(sorted(ALLOWED_IMAGE_EXTS))}. "
            f"Allowed videos: {', '.join(sorted(ALLOWED_VIDEO_EXTS))}."
        )

def validate_file_size(value):
    max_mb = 25  # change as you want
    if value.size > max_mb * 1024 * 1024:
        raise ValidationError(f"File too large. Max size is {max_mb}MB.")

class Announcement(models.Model):
    TARGET_CHOICES = [
        ("all", "Public (All)"),
        ("teachers", "Teachers"),
        ("parent_student", "Parent / Student"),
    ]

    title = models.CharField(max_length=255)
    content = models.TextField()

    target_role = models.CharField(
        max_length=20,
        choices=TARGET_CHOICES,
        default="all",
    )

    publish_date = models.DateTimeField()

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="announcements",
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class AnnouncementMedia(models.Model):
    announcement = models.ForeignKey(
        Announcement,
        on_delete=models.CASCADE,
        related_name="media"
    )
    file = models.FileField(
        upload_to="announcements/",
        validators=[validate_media_file_extension, validate_file_size]
    )
    # Optional binary fallback storage (compressed image bytes)
    data = models.BinaryField(null=True, blank=True, editable=False)
    data_mime = models.CharField(max_length=50, null=True, blank=True, editable=False)
    original_filename = models.CharField(max_length=255, blank=True, null=True, editable=False)
    caption = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Media for {self.announcement_id}"

    def save(self, *args, **kwargs):
        # Avoid recursive double-save
        if getattr(self, "_saving_binary", False):
            return super().save(*args, **kwargs)

        computed = False
        # If Pillow is available and this is an image, compress to WebP and store bytes
        if self.file and Image is not None:
            ext = os.path.splitext(self.file.name)[1].lower()
            if ext in ALLOWED_IMAGE_EXTS:
                try:
                    try:
                        self.file.open()
                    except Exception:
                        pass

                    img = Image.open(self.file)
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
                    self.data = output.read()
                    self.data_mime = "image/webp"
                    self.original_filename = os.path.basename(self.file.name)
                    computed = True
                except Exception:
                    pass

        # First save (will persist file field). If binary data was computed, ensure it's also persisted.
        update_fields = kwargs.get("update_fields", None)
        super().save(*args, **kwargs)

        if computed:
            # Persist binary fields even if caller provided limited update_fields
            binary_fields = ["data", "data_mime", "original_filename"]
            try:
                self._saving_binary = True
                if update_fields:
                    new_update = set(update_fields) | set(binary_fields)
                    super().save(update_fields=list(new_update))
                else:
                    super().save(update_fields=binary_fields)
            finally:
                self._saving_binary = False
