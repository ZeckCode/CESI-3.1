# accounts/views.py
import token
from urllib import request
from decimal import Decimal

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.db import transaction as db_transaction
from django.db.models import Q, Sum
from django.core.cache import cache
import random

from django.contrib.auth import authenticate, login, logout, logout as django_logout
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import generics, status as http_status
from rest_framework.authtoken.models import Token


from .models import User, Subject, Section, TeacherProfile, PasswordResetRequest, UserProfile, AdminProfile

from .serializers import (
    CreateUserSerializer,
    SubjectSerializer,
    SectionSerializer,
    UserDetailSerializer,
    TeacherAssignmentSerializer,
    StudentProfileUpdateSerializer,
    StudentTransferDecisionSerializer,
    StudentTransferRequestSerializer,
    AdminProfileUpdateSerializer,
    PasswordResetRequestCreateSerializer,
    PasswordResetRequestSerializer,
)

from enrollment.models import Enrollment
from classmanagement.models import SchoolYear


#
# USER PASSWORD SET
#
class SetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, uidb64, token):
        password = (request.data.get("password") or "").strip()
        password2 = (request.data.get("password2") or "").strip()

        if not password or not password2:
            return Response(
                {"detail": "Password and confirmation are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password != password2:
            return Response(
                {"detail": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except Exception:
            return Response(
                {"detail": "Invalid link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.is_active = True

        if hasattr(user, "status"):
            user.status = "ACTIVE"

        user.save()

        drf_token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "success": True,
                "message": "Password set successfully.",
                "token": drf_token.key,
            },
            status=status.HTTP_200_OK,
        )




@method_decorator(csrf_exempt, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        identifier = (request.data.get("username") or "").strip()
        password = (request.data.get("password") or "").strip()

        if not identifier or not password:
            return Response({"success": False, "message": "Username/email and password are required."}, status=400)

        # Allow login by username or email (case-insensitive)
        user_qs = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier))
        if user_qs.exists():
            identifier = user_qs.first().username

        user = authenticate(request, username=identifier, password=password)
        if not user:
            return Response({"success": False, "message": "Invalid credentials"}, status=400)

        login(request, user)
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "success": True,
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
            }
        })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([])
def me(request):
    u = request.user
    return Response({"id": u.id, "username": u.username, "role": u.role})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([])
def me_detail(request):
    user = (
        User.objects
        .select_related(
            "admin_profile",
            "profile",
            "profile__section",
            "profile__section__adviser",
            "profile__section__adviser__user",
            "teacher_profile",
            "teacher_profile__section",
            "teacher_profile__section__adviser",
            "teacher_profile__section__adviser__user",
            "teacher_profile__subject",
        )
        .prefetch_related("teacher_profile__subjects")
        .get(pk=request.user.pk)
    )
    return Response(UserDetailSerializer(user, context={"request": request}).data)


class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user

        if user.role == "PARENT_STUDENT":
            profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    "student_first_name": user.username,
                    "student_last_name": "",
                    "parent_first_name": "",
                    "parent_last_name": "",
                    "contact_number": "",
                    "address": "",
                    "grade_level": "grade1",
                }
            )

            if profile.is_read_only:
                return Response(
                    {"detail": "This student account is read-only due to transfer processing."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            new_username = (request.data.get("username") or "").strip()
            if "username" in request.data:
                if not new_username:
                    return Response(
                        {"detail": "Username cannot be empty."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                username_taken = User.objects.filter(username__iexact=new_username).exclude(pk=user.pk).exists()
                if username_taken:
                    return Response(
                        {"detail": "Username is already taken."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                user.username = new_username

            current_password = (request.data.get("current_password") or "").strip()
            new_password = (request.data.get("new_password") or "").strip()
            confirm_password = (request.data.get("confirm_password") or "").strip()

            if current_password or new_password or confirm_password:
                if not current_password:
                    return Response(
                        {"current_password": "Current password is required."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not new_password:
                    return Response(
                        {"new_password": "New password is required."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not confirm_password:
                    return Response(
                        {"confirm_password": "Please confirm the new password."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if new_password != confirm_password:
                    return Response(
                        {"confirm_password": "Passwords do not match."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if len(new_password) < 8:
                    return Response(
                        {"new_password": "New password must be at least 8 characters long."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not user.check_password(current_password):
                    return Response(
                        {"current_password": "Current password is incorrect."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                user.set_password(new_password)

            user.save()

            updatable_fields = [
                "parent_first_name",
                "parent_middle_name",
                "parent_last_name",
                "contact_number",
                "address",
            ]

            for field in updatable_fields:
                if field in request.data:
                    setattr(profile, field, request.data[field])

            if "avatar" in request.FILES:
                profile.avatar = request.FILES["avatar"]

            if request.data.get("remove_avatar") == "true":
                if profile.avatar:
                    profile.avatar.delete(save=False)
                profile.avatar = None

            profile.save()

        elif user.role == "TEACHER":
            from .models import TeacherProfile

            profile, _ = TeacherProfile.objects.get_or_create(user=user)

            if "employee_id" in request.data:
                profile.employee_id = request.data["employee_id"]

            if "avatar" in request.FILES:
                profile.avatar = request.FILES["avatar"]

            if request.data.get("remove_avatar") == "true":
                if profile.avatar:
                    profile.avatar.delete(save=False)
                profile.avatar = None

            profile.save()

        elif user.role == "ADMIN":
            profile, _ = AdminProfile.objects.get_or_create(user=user)

            serializer = AdminProfileUpdateSerializer(data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data

            if "username" in data:
                username = data["username"].strip()
                if not username:
                    return Response(
                        {"detail": "Username cannot be empty."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                exists = User.objects.filter(username__iexact=username).exclude(pk=user.pk).exists()
                if exists:
                    return Response(
                        {"detail": "Username is already taken."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user.username = username

            if "first_name" in data:
                user.first_name = data["first_name"].strip()

            if "last_name" in data:
                user.last_name = data["last_name"].strip()

            if "email" in data:
                email = (data["email"] or "").strip().lower()
                if not email:
                    return Response(
                        {"detail": "Email cannot be empty."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                exists = User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists()
                if exists:
                    return Response(
                        {"detail": "Email is already in use."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user.email = email

            current_password = (data.get("current_password") or "").strip()
            new_password = (data.get("new_password") or "").strip()
            confirm_password = (data.get("confirm_password") or "").strip()

            if current_password or new_password or confirm_password:
                if not user.check_password(current_password):
                    return Response(
                        {"current_password": "Current password is incorrect."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                user.set_password(new_password)

            user.save()
            profile.save()

        user.refresh_from_db()
        user = (
            User.objects
            .select_related(
                "admin_profile",
                "profile",
                "profile__section",
                "profile__section__adviser",
                "profile__section__adviser__user",
                "teacher_profile",
                "teacher_profile__section",
                "teacher_profile__section__adviser",
                "teacher_profile__section__adviser__user",
                "teacher_profile__subject",
            )
            .prefetch_related("teacher_profile__subjects")
            .get(pk=user.pk)
        )
        return Response(UserDetailSerializer(user, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])  # ✅ MUST be authenticated
@throttle_classes([])
def logout_view(request):
    Token.objects.filter(user=request.user).delete()
    django_logout(request)

    if hasattr(request, "session"):
        request.session.flush()

    return Response({"detail": "Logged out."}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_data(request):
    if getattr(request.user, "role", None) != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)
    return Response({"ok": True, "role": "ADMIN"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_data(request):
    if getattr(request.user, "role", None) != "TEACHER":
        return Response({"detail": "Forbidden"}, status=403)
    return Response({"ok": True, "role": "TEACHER"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def parent_data(request):
    if getattr(request.user, "role", None) != "PARENT_STUDENT":
        return Response({"detail": "Forbidden"}, status=403)
    return Response({"ok": True, "role": "PARENT_STUDENT"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_create_user(request):
    if getattr(request.user, "role", None) != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    serializer = CreateUserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            "success": True,
            "message": "User created successfully",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "status": user.status
            }
        }, status=201)

    return Response({
        "success": False,
        "errors": serializer.errors
    }, status=400)


# ══════════════════════════════════════════════════════
# SUBJECT CRUD
# ══════════════════════════════════════════════════════
class SubjectListCreate(generics.ListCreateAPIView):
    queryset = Subject.objects.prefetch_related("teachers__user", "teacher_profiles__user").all().order_by("name")
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _extract_assigned_teacher_ids(payload):
        if "assigned_teachers" in payload:
            raw = payload.get("assigned_teachers") or []
            if not isinstance(raw, list):
                return []
            cleaned = []
            for value in raw:
                try:
                    cleaned.append(int(value))
                except (TypeError, ValueError):
                    continue
            return list(dict.fromkeys(cleaned))

        if "assigned_teacher" in payload:
            value = payload.get("assigned_teacher")
            if value in (None, ""):
                return []
            try:
                return [int(value)]
            except (TypeError, ValueError):
                return []

        return None

    def create(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)

        assigned_teacher_ids = self._extract_assigned_teacher_ids(request.data)
        response = super().create(request, *args, **kwargs)

        if response.status_code == 201 and assigned_teacher_ids is not None:
            for teacher_id in assigned_teacher_ids:
                self._assign_teacher(response.data["id"], teacher_id)
            subj = Subject.objects.prefetch_related("teachers__user", "teacher_profiles__user").get(id=response.data["id"])
            response.data = SubjectSerializer(subj).data

        return response

    @staticmethod
    def _assign_teacher(subject_id, teacher_user_id):
        try:
            teacher_user = User.objects.get(id=teacher_user_id, role="TEACHER")
            subject = Subject.objects.get(id=subject_id)
            tp, _ = TeacherProfile.objects.get_or_create(user=teacher_user)
            tp.subjects.add(subject)

            # Keep legacy primary subject for old consumers.
            if tp.subject_id is None:
                tp.subject = subject
                tp.save(update_fields=["subject"])
        except (User.DoesNotExist, Subject.DoesNotExist):
            pass


class SubjectDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.prefetch_related("teachers__user", "teacher_profiles__user").all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)

        assigned_teacher_ids = SubjectListCreate._extract_assigned_teacher_ids(request.data)
        response = super().update(request, *args, **kwargs)

        if response.status_code == 200 and assigned_teacher_ids is not None:
            subj = self.get_object()
            affected_profiles = TeacherProfile.objects.filter(
                Q(subject=subj) | Q(subjects=subj)
            ).distinct()

            for profile in affected_profiles:
                profile.subjects.remove(subj)
                if profile.subject_id == subj.id:
                    profile.subject = profile.subjects.order_by("id").first()
                    profile.save(update_fields=["subject"])

            for teacher_id in assigned_teacher_ids:
                SubjectListCreate._assign_teacher(subj.id, teacher_id)

            subj.refresh_from_db()
            subj = Subject.objects.prefetch_related("teachers__user", "teacher_profiles__user").get(id=subj.id)
            response.data = SubjectSerializer(subj).data

        return response

    def destroy(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        return super().destroy(request, *args, **kwargs)


# ══════════════════════════════════════════════════════
# SECTION CRUD
# ══════════════════════════════════════════════════════
class SectionListCreate(generics.ListCreateAPIView):
    queryset = Section.objects.none()
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Section.objects
            .select_related("adviser", "adviser__user", "school_year")
            .prefetch_related("students")
            .all()
            .order_by("grade_level", "name")
        )

        school_year_id = self.request.query_params.get("school_year")
        if school_year_id:
            return qs.filter(school_year_id=school_year_id)

        active_sy = SchoolYear.objects.filter(is_active=True).first()
        if active_sy:
            return qs.filter(school_year=active_sy)

        return qs.filter(school_year__isnull=True)

    def create(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)

        payload = request.data.copy()
        if not payload.get("school_year"):
            active_sy = SchoolYear.objects.filter(is_active=True).first()
            if active_sy:
                payload["school_year"] = active_sy.id

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=http_status.HTTP_201_CREATED, headers=headers)


class SectionDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = (
        Section.objects
        .select_related("adviser", "adviser__user", "school_year")
        .prefetch_related("students")
        .all()
    )
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        return super().destroy(request, *args, **kwargs)


# ══════════════════════════════════════════════════════
# USER LIST
# ══════════════════════════════════════════════════════
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_list(request):
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    qs = (
        User.objects
        .select_related(
            "teacher_profile",
            "teacher_profile__subject",
            "teacher_profile__section",
            "teacher_profile__section__adviser",
            "teacher_profile__section__adviser__user",
            "profile",
            "profile__section",
            "profile__section__adviser",
            "profile__section__adviser__user",
        )
        .prefetch_related("teacher_profile__subjects")
        .all()
        .order_by("-created_at")
    )

    role = request.query_params.get("role")
    if role:
        qs = qs.filter(role=role.upper())

    search = request.query_params.get("search", "").strip()
    if search:
        from django.db.models import Q
        qs = qs.filter(Q(username__icontains=search) | Q(email__icontains=search))

    serializer = UserDetailSerializer(qs, many=True, context={"request": request})
    return Response(serializer.data)


# ══════════════════════════════════════════════════════
# TEACHER ASSIGNMENT
# ══════════════════════════════════════════════════════
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_teacher_assignment(request, user_id):
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    try:
        teacher_user = User.objects.get(id=user_id, role="TEACHER")
    except User.DoesNotExist:
        return Response({"detail": "Teacher not found"}, status=404)

    tp, _ = TeacherProfile.objects.get_or_create(user=teacher_user)

    ser = TeacherAssignmentSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    if "subjects" in ser.validated_data:
        subj_ids = ser.validated_data["subjects"]
        assigned_subjects = list(Subject.objects.filter(id__in=subj_ids).order_by("id"))
        tp.subjects.set(assigned_subjects)
        tp.subject = assigned_subjects[0] if assigned_subjects else None

    elif "subject" in ser.validated_data:
        subj_id = ser.validated_data["subject"]
        tp.subject = Subject.objects.get(id=subj_id) if subj_id else None
        if tp.subject:
            tp.subjects.add(tp.subject)
        else:
            tp.subjects.clear()

    if "section" in ser.validated_data:
        sect_id = ser.validated_data["section"]
        tp.section = Section.objects.get(id=sect_id) if sect_id else None

    if "employee_id" in ser.validated_data:
        tp.employee_id = ser.validated_data["employee_id"]

    tp.save()

    teacher_user.refresh_from_db()
    teacher_user = (
        User.objects
        .select_related(
            "teacher_profile",
            "teacher_profile__subject",
            "teacher_profile__section",
            "teacher_profile__section__adviser",
            "teacher_profile__section__adviser__user",
        )
        .prefetch_related("teacher_profile__subjects")
        .get(pk=teacher_user.pk)
    )
    return Response(UserDetailSerializer(teacher_user, context={"request": request}).data)


# ══════════════════════════════════════════════════════
# STUDENT PROFILE UPDATE
# ══════════════════════════════════════════════════════
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_student_profile(request, user_id):
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    try:
        student_user = User.objects.get(id=user_id, role="PARENT_STUDENT")
    except User.DoesNotExist:
        return Response({"detail": "Student not found"}, status=404)

    profile = getattr(student_user, "profile", None)
    if not profile:
        return Response({"detail": "Student profile not found"}, status=404)

    ser = StudentProfileUpdateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    d = ser.validated_data

    for field in [
        "student_first_name",
        "student_middle_name",
        "student_last_name",
        "grade_level",
        "lrn",
        "parent_first_name",
        "parent_middle_name",
        "parent_last_name",
        "contact_number",
    ]:
        if field in d:
            setattr(profile, field, d[field])

    if "section" in d:
        profile.section = Section.objects.get(id=d["section"]) if d["section"] else None

    profile.save()

    if "email" in d:
        email_taken = User.objects.filter(email__iexact=d["email"]).exclude(pk=student_user.pk).exists()
        if email_taken:
            return Response({"email": "This email is already in use."}, status=400)

        student_user.email = d["email"]
        student_user.save(update_fields=["email"])

    student_user.refresh_from_db()
    student_user = (
        User.objects
        .select_related(
            "profile",
            "profile__section",
            "profile__section__adviser",
            "profile__section__adviser__user",
        )
        .get(pk=student_user.pk)
    )
    return Response(UserDetailSerializer(student_user, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def transfer_student(request, user_id):
    if request.user.role != "ADMIN":
        return Response({"detail": "Forbidden"}, status=403)

    try:
        student_user = User.objects.get(id=user_id, role="PARENT_STUDENT")
    except User.DoesNotExist:
        return Response({"detail": "Student not found"}, status=404)

    profile = getattr(student_user, "profile", None)
    if not profile:
        return Response({"detail": "Student profile not found"}, status=404)

    serializer = StudentTransferDecisionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    from finance.models import Transaction

    totals = Transaction.objects.filter(parent=student_user).aggregate(
        total_debit=Sum("debit"),
        total_credit=Sum("credit"),
    )
    total_debit = Decimal(str(totals.get("total_debit") or "0"))
    total_credit = Decimal(str(totals.get("total_credit") or "0"))
    outstanding_balance = total_debit - total_credit

    decision = data.get("decision")
    allow_with_balance = bool(data.get("allow_transfer_with_balance", False))

    if decision == "APPROVED" and outstanding_balance > 0 and not allow_with_balance:
        return Response(
            {
                "detail": "Student has outstanding balance. Enable 'allow transfer with balance' to approve.",
                "outstanding_balance": str(outstanding_balance),
            },
            status=400,
        )

    profile.transfer_status = decision
    profile.transfer_reason = data.get("transfer_reason", "")
    profile.destination_school_name = data.get("destination_school_name", "")
    profile.destination_school_address = data.get("destination_school_address", "")
    profile.destination_school_contact = data.get("destination_school_contact", "")
    profile.transfer_reference_number = data.get("transfer_reference_number", "")
    profile.transfer_notes = data.get("transfer_notes", "")
    profile.allow_transfer_with_balance = allow_with_balance
    profile.outstanding_balance_snapshot = outstanding_balance
    if not profile.transfer_requested_at:
        profile.transfer_requested_at = timezone.now()

    if data.get("transfer_date"):
        profile.transfer_date = data["transfer_date"]
    elif decision == "APPROVED":
        profile.transfer_date = timezone.localdate()

    if "transfer_clearance" in request.FILES:
        profile.transfer_clearance = request.FILES["transfer_clearance"]

    if decision == "APPROVED":
        grade = str(profile.grade_level or "").lower()
        if grade in ["prek", "kinder"]:
            student_user.status = "NEW"
        else:
            student_user.status = "TRANSFERRED"

        student_user.is_active = True
        profile.is_read_only = True
        profile.transfer_approved_at = timezone.now()
        profile.transfer_approved_by = request.user

        latest_enrollment = (
            Enrollment.objects
            .filter(Q(parent_user=student_user) | Q(student=student_user))
            .order_by("-created_at", "-id")
            .first()
        )
        if latest_enrollment:
            latest_enrollment.status = "COMPLETED"
            latest_enrollment.completed_at = timezone.now()
            if grade in ["prek", "kinder"]:
                latest_enrollment.student_type = "new"
            note = f"Transfer decision approved by {request.user.username}."
            latest_enrollment.remarks = f"{latest_enrollment.remarks or ''}\n{note}".strip()
            latest_enrollment.save(update_fields=["status", "completed_at", "student_type", "remarks"])

    elif decision == "REJECTED":
        profile.is_read_only = False
        student_user.status = "ACTIVE"
        student_user.is_active = True

    else:  # PENDING
        profile.is_read_only = True
        student_user.status = "SUSPENDED"
        student_user.is_active = True

    profile.save()
    student_user.save(update_fields=["status", "is_active"])

    student_user.refresh_from_db()
    student_user = (
        User.objects
        .select_related(
            "profile",
            "profile__section",
            "profile__section__adviser",
            "profile__section__adviser__user",
        )
        .get(pk=student_user.pk)
    )

    return Response(
        {
            "detail": "Transfer decision saved.",
            "outstanding_balance": str(outstanding_balance),
            "user": UserDetailSerializer(student_user, context={"request": request}).data,
        },
        status=200,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def request_transfer(request):
    if request.user.role != "PARENT_STUDENT":
        return Response({"detail": "Only student accounts can request transfer."}, status=403)

    student_user = request.user
    profile = getattr(student_user, "profile", None)
    if not profile:
        return Response({"detail": "Student profile not found."}, status=404)

    if profile.transfer_status == "PENDING":
        return Response({"detail": "A transfer request is already pending admin review."}, status=400)

    # Business rule: block transfer request once any Q2 grade exists.
    from grades.models import AcademicRecord, StudentScore, ClassStanding

    has_q2_grade = (
        AcademicRecord.objects.filter(student=student_user, q2__isnull=False).exists()
        or StudentScore.objects.filter(student=student_user, grade_item__quarter=2).exists()
        or ClassStanding.objects.filter(student=student_user, quarter=2).exists()
    )

    if has_q2_grade:
        return Response(
            {"detail": "Transfer request is not allowed because 2nd quarter grades already exist."},
            status=400,
        )

    serializer = StudentTransferRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    profile.transfer_status = "PENDING"
    profile.transfer_reason = data.get("transfer_reason", "")
    profile.destination_school_name = data.get("destination_school_name", "")
    profile.destination_school_address = data.get("destination_school_address", "")
    profile.destination_school_contact = data.get("destination_school_contact", "")
    profile.transfer_reference_number = data.get("transfer_reference_number", "")
    profile.transfer_notes = data.get("transfer_notes", "")
    profile.transfer_requested_at = timezone.now()
    profile.transfer_approved_at = None
    profile.transfer_approved_by = None
    profile.save()

    return Response(
        {
            "detail": "Transfer request submitted. Awaiting admin approval.",
            "transfer_status": profile.transfer_status,
        },
        status=200,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_user_with_records(request, user_id):
    if request.user.role != "ADMIN":
        return Response({"detail": "Only admins can delete users."}, status=403)

    if request.user.id == user_id:
        return Response({"detail": "You cannot delete your own admin account."}, status=400)

    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=404)

    from enrollment.models import Enrollment
    from grades.models import AcademicRecord, StudentScore, ClassStanding
    from finance.models import Transaction, ProofOfPayment, AdvanceRequest

    with db_transaction.atomic():
        enrollments_deleted = Enrollment.objects.filter(
            Q(student=target_user) | Q(parent_user=target_user)
        ).delete()[0]
        academic_deleted = AcademicRecord.objects.filter(student=target_user).delete()[0]
        scores_deleted = StudentScore.objects.filter(student=target_user).delete()[0]
        standings_deleted = ClassStanding.objects.filter(student=target_user).delete()[0]
        transactions_deleted = Transaction.objects.filter(parent=target_user).delete()[0]
        proofs_deleted = ProofOfPayment.objects.filter(user=target_user).delete()[0]
        advance_deleted = AdvanceRequest.objects.filter(user=target_user).delete()[0]

        username = target_user.username
        role = target_user.role
        target_user.delete()

    return Response(
        {
            "detail": "User and related records deleted successfully.",
            "deleted": {
                "user": username,
                "role": role,
                "enrollments": enrollments_deleted,
                "academic_records": academic_deleted,
                "student_scores": scores_deleted,
                "class_standings": standings_deleted,
                "transactions": transactions_deleted,
                "proof_of_payments": proofs_deleted,
                "advance_requests": advance_deleted,
            },
        },
        status=200,
    )











# ══════════════════════════════════════════════════════
# PASSWORD RESET REQUESTS
# ══════════════════════════════════════════════════════

class PasswordResetRequestCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        recipient_email = serializer.validated_data["recipient_email"]
        message = serializer.validated_data.get("message", "").strip()

        verification_code = f"{random.randint(0, 999999):06d}"
        cache_key = f"pwd-reset-verify:{user.id}:{recipient_email}"
        cache.set(
            cache_key,
            {
                "user_id": user.id,
                "recipient_email": recipient_email,
                "message": message,
                "code": verification_code,
                "attempts": 0,
            },
            timeout=10 * 60,
        )

        send_mail(
            subject="CESI Password Reset Verification Code",
            message=(
                f"Hello {user.username},\n\n"
                f"Your password reset verification code is: {verification_code}\n\n"
                f"This code expires in 10 minutes.\n"
                f"If you did not request this, please ignore this email.\n"
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@cesi.com"),
            recipient_list=[recipient_email],
            fail_silently=False,
        )

        return Response(
            {
                "detail": "Verification code sent to your email. Enter the code to continue.",
                "requires_code": True,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestVerifyCodeView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        recipient_email = serializer.validated_data["recipient_email"]
        message = serializer.validated_data.get("message", "").strip()
        code = (request.data.get("code") or "").strip()

        if not code:
            return Response(
                {"detail": "Verification code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache_key = f"pwd-reset-verify:{user.id}:{recipient_email}"
        payload = cache.get(cache_key)
        if not payload:
            return Response(
                {"detail": "Verification expired. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attempts = int(payload.get("attempts", 0))
        if attempts >= 5:
            cache.delete(cache_key)
            return Response(
                {"detail": "Too many incorrect attempts. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if payload.get("code") != code:
            payload["attempts"] = attempts + 1
            cache.set(cache_key, payload, timeout=10 * 60)
            return Response(
                {"detail": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_requests = PasswordResetRequest.objects.filter(
            user=user,
            status__in=["PENDING", "LINK_SENT"]
        ).order_by("-requested_at", "-id")

        final_message = message or payload.get("message", "")
        refreshed_existing = False

        if existing_requests.exists():
            current_request = existing_requests.first()
            current_request.email = recipient_email
            current_request.message = final_message
            current_request.status = "PENDING"
            current_request.requested_at = timezone.now()
            current_request.sent_at = None
            current_request.completed_at = None
            current_request.save(
                update_fields=[
                    "email",
                    "message",
                    "status",
                    "requested_at",
                    "sent_at",
                    "completed_at",
                ]
            )

            duplicate_ids = list(existing_requests.values_list("id", flat=True))[1:]
            if duplicate_ids:
                PasswordResetRequest.objects.filter(id__in=duplicate_ids).delete()

            refreshed_existing = True
        else:
            PasswordResetRequest.objects.create(
                user=user,
                email=recipient_email,
                message=final_message,
                status="PENDING",
            )

        cache.delete(cache_key)

        return Response(
            {
                "detail": (
                    "Password reset request refreshed and resubmitted. Please wait for admin approval."
                    if refreshed_existing
                    else "Password reset request submitted. Please wait for admin approval."
                )
            },
            status=status.HTTP_201_CREATED,
        )


# class PasswordResetRequestCreateView(APIView):
#     permission_classes = [permissions.AllowAny]
#     authentication_classes = []

#     def post(self, request):
#         serializer = PasswordResetRequestCreateSerializer(data=request.data)
#         serializer.is_valid(raise_exception=True)

#         email = serializer.validated_data["email"].strip().lower()
#         message = serializer.validated_data.get("message", "").strip()

#         user = User.objects.filter(email__iexact=email).first()
#         if not user:
#             return Response(
#                 {"detail": "No account found with this email."},
#                 status=status.HTTP_404_NOT_FOUND,
#             )

#         PasswordResetRequest.objects.filter(
#             user=user,
#             status__in=["PENDING", "LINK_SENT"]
#         ).delete()

#         PasswordResetRequest.objects.create(
#             user=user,
#             email=user.email,
#             message=message,
#             status="PENDING",
#         )

#         return Response(
#             {"detail": "Password reset request submitted. Please wait for admin approval."},
#             status=status.HTTP_201_CREATED,
#         )

class AdminPasswordResetRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if (
            getattr(request.user, "role", None) != "ADMIN"
            and not request.user.is_staff
            and not request.user.is_superuser
        ):
            return Response(
                {"detail": "Unauthorized."},
                status=status.HTTP_403_FORBIDDEN,
            )

        qs = PasswordResetRequest.objects.select_related("user").order_by("-requested_at")
        serializer = PasswordResetRequestSerializer(qs, many=True)
        return Response(serializer.data)


class AdminSendPasswordResetLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if (
            getattr(request.user, "role", None) != "ADMIN"
            and not request.user.is_staff
            and not request.user.is_superuser
        ):
            return Response(
                {"detail": "Unauthorized."},
                status=status.HTTP_403_FORBIDDEN,
            )

        reset_request = PasswordResetRequest.objects.select_related("user").filter(pk=pk).first()
        if not reset_request:
            return Response(
                {"detail": "Request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if reset_request.status == "COMPLETED":
            return Response(
                {"detail": "This request has already been completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = reset_request.user

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        reset_link = f"{frontend_url}/reset-password/{uid}/{token}"

        subject = "CESI Password Reset Link"
        message = (
            f"Hello {user.username or user.email},\n\n"
            f"Your password reset request has been approved by the admin.\n\n"
            f"Click this link to reset your password:\n"
            f"{reset_link}\n\n"
            f"If you did not request this, please ignore this email.\n\n"
            f"Thanks,\n"
            f"CESI Admin"
        )
        recipient_email = (reset_request.email or user.email or "").strip()
        if not recipient_email:
            return Response(
                {"detail": "No recipient email found for this request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        print("SENDING TO:", recipient_email)
        print("RESET LINK:", reset_link)
            
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@cesi.com"),
            recipient_list=[recipient_email],
            fail_silently=False,
        )

        reset_request.status = "LINK_SENT"
        reset_request.sent_at = timezone.now()
        reset_request.save()

        return Response(
            {"detail": "Reset link sent successfully."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        print("RESET DATA:", request.data)

        uid = (request.data.get("uid") or "").strip()
        token = (request.data.get("token") or "").strip()
        password = (request.data.get("password") or "").strip()
        confirm_password = (request.data.get("confirm_password") or "").strip()

        if not uid or not token or not password or not confirm_password:
            return Response(
                {"detail": "uid, token, password, and confirm_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password != confirm_password:
            return Response(
                {"detail": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response(
                {"detail": "Invalid reset link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        print("DECODED USER:", user.pk, user.username)
        print("TOKEN RECEIVED:", token)
        print("TOKEN CHECK:", default_token_generator.check_token(user, token))

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.is_active = True
        if hasattr(user, "status"):
            user.status = "ACTIVE"
        user.save()

        PasswordResetRequest.objects.filter(
            user=user,
            status__in=["PENDING", "LINK_SENT"]
        ).update(
            status="COMPLETED",
            completed_at=timezone.now()
        )

        return Response(
            {"detail": "Password reset successful."},
            status=status.HTTP_200_OK,
        )