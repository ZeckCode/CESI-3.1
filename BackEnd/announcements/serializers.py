# announcements/serializers.py
from rest_framework import serializers
from .models import Announcement, AnnouncementMedia

class AnnouncementMediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = AnnouncementMedia
        fields = ["id", "file", "file_url", "caption", "uploaded_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        # If we have binary data stored in the DB, prefer the API streaming endpoint.
        if getattr(obj, "data", None):
            if request:
                return request.build_absolute_uri(f"/api/announcements/media/{obj.pk}/")
            return f"/api/announcements/media/{obj.pk}/"

        # If storage file exists, prefer its URL (but avoid returning relative /media paths
        # when behind a static SPA that may intercept them). If file.url is relative, fall
        # back to the streaming endpoint if data is present (handled above) or return the
        # absolute URL built from request.
        try:
            if obj.file and obj.file.storage.exists(obj.file.name):
                url = obj.file.url
                if isinstance(url, str) and url.startswith("/"):
                    # Build absolute URI so clients don't hit static-site fallbacks.
                    return request.build_absolute_uri(url) if request else url
                return url
        except Exception:
            # storage check failed — fall through to last-resort behavior
            pass

        # As a last resort, return the file.url (may be an absolute or relative path)
        if obj.file:
            url = obj.file.url
            return request.build_absolute_uri(url) if request else url

        return None


class AnnouncementSerializer(serializers.ModelSerializer):
    media = AnnouncementMediaSerializer(many=True, read_only=True)

    class Meta:
        model = Announcement
        fields = [
            "id", "title", "content", "target_role",
            "publish_date", "created_by", "is_active",
            "created_at", "media"
        ]
        # ✅ lock these down
        read_only_fields = ["id", "created_by", "created_at", "media", "is_active"]

    def create(self, validated_data):
        # ✅ force active on create
        validated_data["is_active"] = True
        return super().create(validated_data)