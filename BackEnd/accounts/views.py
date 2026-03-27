# accounts/views.py
import token
from urllib import request

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.db.models import Q

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


from .models import User, Subject, Section, TeacherProfile, PasswordResetRequest

from .serializers import (
    CreateUserSerializer,
    SubjectSerializer,
    SectionSerializer,
    UserDetailSerializer,
    TeacherAssignmentSerializer,
    StudentProfileUpdateSerializer,
    PasswordResetRequestCreateSerializer,
    PasswordResetRequestSerializer,
)

from enrollment.models import Enrollment


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
        .get(pk=request.user.pk)
    )
    return Response(UserDetailSerializer(user, context={"request": request}).data)


class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user

        if user.role == "PARENT_STUDENT":
            from .models import UserProfile

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

        user.refresh_from_db()
        user = (
            User.objects
            .select_related(
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
    queryset = Subject.objects.prefetch_related("teachers__user").all().order_by("name")
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)

        assigned_teacher = request.data.get("assigned_teacher")
        response = super().create(request, *args, **kwargs)

        if response.status_code == 201 and assigned_teacher:
            self._assign_teacher(response.data["id"], assigned_teacher)
            subj = Subject.objects.prefetch_related("teachers__user").get(id=response.data["id"])
            response.data = SubjectSerializer(subj).data

        return response

    @staticmethod
    def _assign_teacher(subject_id, teacher_user_id):
        try:
            teacher_user = User.objects.get(id=teacher_user_id, role="TEACHER")
            tp, _ = TeacherProfile.objects.get_or_create(user=teacher_user)
            tp.subject_id = subject_id
            tp.save()
        except User.DoesNotExist:
            pass


class SubjectDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.prefetch_related("teachers__user").all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)

        assigned_teacher = request.data.get("assigned_teacher")
        response = super().update(request, *args, **kwargs)

        if response.status_code == 200 and assigned_teacher is not None:
            subj = self.get_object()
            TeacherProfile.objects.filter(subject=subj).update(subject=None)
            if assigned_teacher:
                SubjectListCreate._assign_teacher(subj.id, assigned_teacher)
            subj.refresh_from_db()
            subj = Subject.objects.prefetch_related("teachers__user").get(id=subj.id)
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
    queryset = (
        Section.objects
        .select_related("adviser", "adviser__user")
        .prefetch_related("students")
        .all()
        .order_by("grade_level", "name")
    )
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if request.user.role != "ADMIN":
            return Response({"detail": "Forbidden"}, status=403)
        return super().create(request, *args, **kwargs)


class SectionDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = (
        Section.objects
        .select_related("adviser", "adviser__user")
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

    if "subject" in ser.validated_data:
        subj_id = ser.validated_data["subject"]
        tp.subject = Subject.objects.get(id=subj_id) if subj_id else None

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











# ══════════════════════════════════════════════════════
# PASSWORD RESET REQUESTS
# ══════════════════════════════════════════════════════

class PasswordResetRequestCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()
        message = serializer.validated_data.get("message", "").strip()

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response(
                {"detail": "No account found with this email."},
                status=status.HTTP_404_NOT_FOUND,
            )

        existing_pending = PasswordResetRequest.objects.filter(
            user=user,
            status__in=["PENDING", "LINK_SENT"]
        ).exists()

        if existing_pending:
            return Response(
                {"detail": "A password reset request is already pending for this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        PasswordResetRequest.objects.create(
            user=user,
            email=user.email,
            message=message,
            status="PENDING",
        )

        return Response(
            {"detail": "Password reset request submitted. Please wait for admin approval."},
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
        print("SENDING TO:", user.email)
        print("RESET LINK:", reset_link)
            
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@cesi.com"),
            recipient_list=[user.email],
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