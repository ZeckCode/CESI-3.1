# announcements/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated,AllowAny
from rest_framework.parsers import MultiPartParser, FormParser

from django.db.models import Q
from django.utils import timezone

from .models import Announcement, AnnouncementMedia
from .serializers import AnnouncementSerializer
from .permissions import IsTeacherOrAdmin
from django.shortcuts import get_object_or_404, redirect
from django.http import HttpResponse, Http404
import os


class AnnouncementListCreate(APIView):
    """
    GET: List all announcements (public)
    POST: Create a new announcement (teachers/admin only)
    """

    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsTeacherOrAdmin()]


    def get(self, request):
        user = request.user if request.user.is_authenticated else None

        # base: only active
        qs = Announcement.objects.filter(is_active=True).order_by("-publish_date")

        # public (not logged in): only public + already published
        if not user:
            qs = qs.filter(target_role="all", publish_date__lte=timezone.now())
        else:
            role = str(getattr(user, "role", "")).upper()

            # admin: sees all active (including scheduled)
            if user.is_staff or user.is_superuser or "ADMIN" in role:
                pass

            elif "TEACHER" in role:
                qs = qs.filter(Q(target_role="teachers") | Q(target_role="all"))

            elif "PARENT_STUDENT" in role:
                qs = qs.filter(Q(target_role="parent_student") | Q(target_role="all"))

            else:
                qs = qs.filter(target_role="all", publish_date__lte=timezone.now())

        serializer = AnnouncementSerializer(
            qs,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)

    def post(self, request):
        serializer = AnnouncementSerializer(
            data=request.data,
            context={"request": request},  # ✅ REQUIRED for file_url
        )
        serializer.is_valid(raise_exception=True)

        # Save announcement with creator
        announcement = serializer.save(created_by=request.user)

        # Handle uploaded media files
        for f in request.FILES.getlist("files"):
            AnnouncementMedia.objects.create(
                announcement=announcement,
                file=f,
            )

        # Return full object with media + absolute URLs
        return Response(
            AnnouncementSerializer(
                announcement,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class AnnouncementDetail(APIView):
    """Retrieve, update or delete a single Announcement."""

    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsTeacherOrAdmin()]

    def get_object(self, pk):
        return get_object_or_404(Announcement, pk=pk)

    def get(self, request, pk):
        announcement = self.get_object(pk)
        user = request.user if request.user.is_authenticated else None

        # Visibility rules mirror the list view
        if not user:
            if announcement.target_role != "all" or announcement.publish_date > timezone.now() or not announcement.is_active:
                raise Http404
        else:
            role = str(getattr(user, "role", "")).upper()
            if user.is_staff or user.is_superuser or "ADMIN" in role:
                pass
            elif "TEACHER" in role:
                if announcement.target_role not in ("teachers", "all") or not announcement.is_active:
                    raise Http404
            elif "PARENT_STUDENT" in role:
                if announcement.target_role not in ("parent_student", "all") or not announcement.is_active:
                    raise Http404
            else:
                if announcement.target_role != "all" or announcement.publish_date > timezone.now() or not announcement.is_active:
                    raise Http404

        serializer = AnnouncementSerializer(announcement, context={"request": request})
        return Response(serializer.data)

    def put(self, request, pk):
        announcement = self.get_object(pk)
        serializer = AnnouncementSerializer(announcement, data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request, pk):
        announcement = self.get_object(pk)
        serializer = AnnouncementSerializer(announcement, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        announcement = self.get_object(pk)
        announcement.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def announcement_media_raw(request, pk):
    """Serve AnnouncementMedia bytes when storage file is missing, or redirect to storage URL."""
    media = get_object_or_404(AnnouncementMedia, pk=pk)

    # Prefer existing storage URL when available
    try:
        if media.file and media.file.storage.exists(media.file.name):
            url = media.file.url
            # If storage returned a relative URL, make it absolute so redirects go to the correct origin
            if request and isinstance(url, str) and url.startswith("/"):
                url = request.build_absolute_uri(url)
            return redirect(url)
    except Exception:
        # storage check failed — fall through to DB bytes
        pass

    # If we have binary data stored in DB, stream it with a helpful filename
    if media.data:
        mime = media.data_mime or "application/octet-stream"
        # derive a sensible extension for content-disposition
        mime_map = {
            "image/webp": "webp",
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/gif": "gif",
            "video/mp4": "mp4",
            "video/webm": "webm",
        }
        ext = mime_map.get(mime, "")
        base = media.original_filename or f"announcement-{media.pk}"
        base_noext = os.path.splitext(base)[0]
        filename = f"{base_noext}.{ext}" if ext else base

        response = HttpResponse(media.data, content_type=mime)
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    raise Http404("Media not available")
