from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.conf import settings
from accounts.models import User, UserProfile
from django.urls import reverse
from django.utils.text import slugify
# ============================
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.throttling import ScopedRateThrottle
from django.utils import timezone
# ============================
from django.db.models import Max

from .models import Enrollment
from .serializers import (
    EnrollmentSerializer,
    EnrollmentDetailedSerializer,
    EnrollmentCreateSerializer,
)


class EnrollmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing student enrollments.
    Public can CREATE only (throttled).
    Admin can read/update/approve/decline/delete.
    """
    queryset = Enrollment.objects.select_related("student", "section", "parent_info").all()

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [IsAdminUser()]

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "enrollment_public"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return EnrollmentCreateSerializer
        if self.action in ["retrieve", "mark_completed", "mark_dropped", "mark_active"]:
            return EnrollmentDetailedSerializer
        return EnrollmentSerializer

    def get_queryset(self):
        queryset = Enrollment.objects.select_related("student", "section", "parent_info").all()

        student_id = self.request.query_params.get("student_id")
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        section_id = self.request.query_params.get("section_id")
        if section_id:
            queryset = queryset.filter(section_id=section_id)

        grade_level = self.request.query_params.get("grade_level")
        if grade_level:
            queryset = queryset.filter(grade_level=grade_level)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        academic_year = self.request.query_params.get("academic_year")
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)

        return queryset

    # ------------------- Helpers -------------------

    def generate_student_number(self):
        year = timezone.now().year
        prefix = str(year)

        last = (
            Enrollment.objects
            .filter(student_number__startswith=prefix)
            .aggregate(max_sn=Max("student_number"))
            .get("max_sn")
        )

        if last:
            last_seq = int(last[len(prefix):])
            next_seq = last_seq + 1
        else:
            next_seq = 1

        return f"{prefix}{next_seq:06d}"

    # ------------------- Custom Actions -------------------

    @action(detail=False, methods=["get"])
    def by_student(self, request):
        student_id = request.query_params.get("student_id")
        if not student_id:
            return Response({"error": "student_id query parameter is required"},
                            status=status.HTTP_400_BAD_REQUEST)
        enrollments = Enrollment.objects.filter(student_id=student_id)
        serializer = self.get_serializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_section(self, request):
        section_id = request.query_params.get("section_id")
        if not section_id:
            return Response({"error": "section_id query parameter is required"},
                            status=status.HTTP_400_BAD_REQUEST)
        enrollments = Enrollment.objects.filter(section_id=section_id)
        serializer = self.get_serializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_grade(self, request):
        grade_level = request.query_params.get("grade_level")
        if not grade_level:
            return Response({"error": "grade_level query parameter is required"},
                            status=status.HTTP_400_BAD_REQUEST)
        enrollments = Enrollment.objects.filter(grade_level=grade_level)
        serializer = self.get_serializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def mark_completed(self, request, pk=None):
        enrollment = self.get_object()
        enrollment.status = "COMPLETED"
        enrollment.completed_at = timezone.now()

        note = "COMPLETED BY ADMIN"
        enrollment.remarks = (enrollment.remarks or "").strip()
        enrollment.remarks = f"{enrollment.remarks} | {note}".strip(" |")

        enrollment.save()
        serializer = self.get_serializer(enrollment)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def mark_dropped(self, request, pk=None):
        enrollment = self.get_object()
        enrollment.status = "DROPPED"
        enrollment.completed_at = timezone.now()

        note = "DECLINED BY ADMIN"
        enrollment.remarks = (enrollment.remarks or "").strip()
        enrollment.remarks = f"{enrollment.remarks} | {note}".strip(" |")

        enrollment.save()
        serializer = self.get_serializer(enrollment)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def mark_active(self, request, pk=None):
        enrollment = self.get_object()

        grade_code = (enrollment.grade_level or "").strip()
        VALID_GRADES = {"prek", "kinder", "grade1", "grade2", "grade3",
                        "grade4", "grade5", "grade6"}

        if grade_code not in VALID_GRADES:
            return Response(
                {"detail": f"Invalid grade_level on enrollment: {enrollment.grade_level}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Detect promotion: student_type == "old" means this is a promoted enrollment ──
        is_promotion = (enrollment.student_type or "").strip().lower() == "old"

        # Safe parent_info access
        parent_info = getattr(enrollment, "parent_info", None)
        guardian_full = ""
        if parent_info:
            guardian_full = (
                parent_info.guardian_name
                or parent_info.mother_name
                or parent_info.father_name
                or ""
            ).strip()

        guardian_parts = guardian_full.split()
        parent_first_name = guardian_parts[0] if guardian_parts else ""
        parent_last_name = " ".join(guardian_parts[1:]) if len(guardian_parts) > 1 else ""

        parent_email = (enrollment.email or "").strip().lower()

        with transaction.atomic():
            # 1) Assign student number if not yet set
            if not enrollment.student_number:
                while True:
                    candidate = self.generate_student_number()
                    if not Enrollment.objects.filter(student_number=candidate).exists():
                        enrollment.student_number = candidate
                        break

            # 2) Set enrollment ACTIVE
            enrollment.status = "ACTIVE"
            note = "APPROVED BY ADMIN"
            enrollment.remarks = (enrollment.remarks or "").strip()
            if note not in enrollment.remarks:
                enrollment.remarks = f"{enrollment.remarks} | {note}".strip(" |")
            enrollment.save(update_fields=["status", "remarks", "updated_at", "student_number"])

            if parent_email:

                # ── PROMOTION PATH: update existing account only ──
                if is_promotion:
                    # Find the existing parent user by email
                    existing_user = User.objects.filter(email__iexact=parent_email).first()

                    if existing_user:
                        # Link this new enrollment to the same parent user
                        enrollment.parent_user = existing_user
                        enrollment.save(update_fields=["parent_user"])

                        # Update their profile to reflect the new grade/year
                        profile = UserProfile.objects.filter(user=existing_user).first()
                        if profile:
                            profile.grade_level       = grade_code
                            profile.student_number    = enrollment.student_number or profile.student_number
                            profile.payment_mode      = enrollment.payment_mode   or profile.payment_mode
                            profile.section           = enrollment.section        or profile.section
                            # Refresh contact info in case it changed
                            profile.contact_number    = (
                                enrollment.mobile_number
                                or enrollment.telephone_number
                                or profile.contact_number
                            )
                            profile.address           = enrollment.address or profile.address
                            profile.save()

                        # ── Send promotion notification email ──
                        send_mail(
                            subject="Student Promotion Confirmed",
                            message=(
                                f"Dear Parent/Guardian,\n\n"
                                f"This is to confirm that {enrollment.first_name} {enrollment.last_name} "
                                f"has been successfully promoted.\n\n"
                                f"New Grade Level : {grade_code}\n"
                                f"Academic Year   : {enrollment.academic_year}\n"
                                f"Student No.     : {enrollment.student_number}\n\n"
                                f"You may log in to the Parent Portal to view the updated enrollment.\n\n"
                                "If you have any questions, please contact the school."
                            ),
                            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
                            recipient_list=[parent_email],
                            fail_silently=False,
                        )

                    # If no existing user found for a promoted enrollment, log a warning
                    # but do NOT create a new account — admin should investigate
                    else:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(
                            f"Promotion approved for enrollment #{enrollment.id} but no existing "
                            f"parent user found for email '{parent_email}'. Profile not updated."
                        )

                # ── NEW STUDENT PATH: create account as before ──
                else:
                    parent_user = User.objects.filter(email__iexact=parent_email).first()

                    if not parent_user:
                        base_username = f"{(enrollment.first_name or '')}{(enrollment.last_name or '')}".lower()
                        base_username = base_username.replace(" ", "") or "parent"

                        username = base_username
                        i = 1
                        while User.objects.filter(username=username).exists():
                            i += 1
                            username = f"{base_username}{i}"

                        parent_user = User.objects.create(
                            username=username,
                            email=parent_email,
                            role="PARENT_STUDENT",
                            status="ACTIVE",
                            is_active=True,
                        )
                        parent_user.set_unusable_password()
                        parent_user.save()

                    # Create or update profile
                    profile, created = UserProfile.objects.get_or_create(
                        user=parent_user,
                        defaults={
                            "student_first_name":  enrollment.first_name  or "",
                            "student_middle_name": enrollment.middle_name or "",
                            "student_last_name":   enrollment.last_name   or "",
                            "grade_level":         grade_code,
                            "lrn":                 enrollment.lrn         or "",
                            "student_number":      enrollment.student_number or "",
                            "payment_mode":        enrollment.payment_mode   or "",
                            "section":             enrollment.section,
                            "parent_first_name":   parent_first_name,
                            "parent_middle_name":  "",
                            "parent_last_name":    parent_last_name,
                            "contact_number":      enrollment.mobile_number or enrollment.telephone_number or "",
                            "address":             enrollment.address or "",
                        },
                    )

                    if not created:
                        profile.student_first_name  = profile.student_first_name  or (enrollment.first_name  or "")
                        profile.student_middle_name = profile.student_middle_name or (enrollment.middle_name or "")
                        profile.student_last_name   = profile.student_last_name   or (enrollment.last_name   or "")
                        profile.grade_level         = grade_code or profile.grade_level
                        profile.lrn                 = enrollment.lrn            or profile.lrn
                        profile.student_number      = enrollment.student_number or profile.student_number
                        profile.payment_mode        = enrollment.payment_mode   or profile.payment_mode
                        profile.section             = enrollment.section        or profile.section
                        profile.contact_number      = enrollment.mobile_number or enrollment.telephone_number or profile.contact_number
                        profile.address             = enrollment.address or profile.address
                        profile.save()

                    # Link enrollment to parent user
                    enrollment.parent_user = parent_user
                    enrollment.save(update_fields=["parent_user"])

                    # Send set-password email for new accounts only
                    uidb64 = urlsafe_base64_encode(force_bytes(parent_user.pk))
                    token  = default_token_generator.make_token(parent_user)

                    frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
                    reset_url = f"{frontend_base}/set-password/{uidb64}/{token}"

                    send_mail(
                        subject="Your Parent Portal Account",
                        message=(
                            f"Student: {enrollment.first_name} {enrollment.last_name}\n\n"
                            f"Username: {parent_user.username}\n"
                            f"Email:    {parent_user.email}\n\n"
                            f"Set your password here:\n{reset_url}\n\n"
                            "If you did not request this, ignore this email."
                        ),
                        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
                        recipient_list=[parent_email],
                        fail_silently=False,
                    )

        serializer = self.get_serializer(enrollment)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def active_enrollments(self, request):
        enrollments = Enrollment.objects.filter(status="ACTIVE")
        serializer  = self.get_serializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def statistics(self, request):
        total_enrollments     = Enrollment.objects.count()
        active_enrollments    = Enrollment.objects.filter(status="ACTIVE").count()
        completed_enrollments = Enrollment.objects.filter(status="COMPLETED").count()
        dropped_enrollments   = Enrollment.objects.filter(status="DROPPED").count()
        pending_enrollments   = Enrollment.objects.filter(status="PENDING").count()

        by_grade = {}
        grade_map = {
            "prek":   "Pre-Kinder",
            "kinder": "Kinder",
            "grade1": "Grade 1",
            "grade2": "Grade 2",
            "grade3": "Grade 3",
            "grade4": "Grade 4",
            "grade5": "Grade 5",
            "grade6": "Grade 6",
        }
        for code, label in grade_map.items():
            by_grade[label] = Enrollment.objects.filter(grade_level=code).count()

        return Response({
            "total_enrollments":     total_enrollments,
            "active_enrollments":    active_enrollments,
            "completed_enrollments": completed_enrollments,
            "dropped_enrollments":   dropped_enrollments,
            "pending_enrollments":   pending_enrollments,
            "by_grade":              by_grade,
        })