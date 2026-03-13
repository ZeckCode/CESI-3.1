from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings

from django.contrib.auth import authenticate, login, logout, logout as django_logout
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework import generics
from rest_framework.authtoken.models import Token

from .models import User, Subject, Section, TeacherProfile
from .serializers import (
    CreateUserSerializer,
    SubjectSerializer,
    SectionSerializer,
    UserDetailSerializer,
    TeacherAssignmentSerializer,
    StudentProfileUpdateSerializer,
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


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()

        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.filter(email__iexact=email).first()

        if user:
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
            reset_url = f"{frontend_base}/reset-password/{uidb64}/{token}"

            send_mail(
                subject="Reset Your Password",
                message=(
                    f"Hello {user.username},\n\n"
                    f"You requested to reset your password.\n\n"
                    f"Click or open this link:\n{reset_url}\n\n"
                    f"If you did not request this, you can ignore this email."
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
                recipient_list=[user.email],
                fail_silently=False,
            )

        return Response(
            {"success": True, "message": "If that email exists, a reset link has been sent."},
            status=status.HTTP_200_OK
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        uidb64 = request.data.get("uidb64", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not uidb64 or not token:
            return Response(
                {"detail": "Missing token."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not new_password or len(new_password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != confirm_password:
            return Response(
                {"detail": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except Exception:
            return Response(
                {"detail": "Invalid link."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Invalid or expired link."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.is_active = True
        user.status = "ACTIVE"
        user.save()

        return Response(
            {"success": True, "message": "Password reset successfully."},
            status=status.HTTP_200_OK
        )


@method_decorator(csrf_exempt, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "").strip()

        try:
            actual_user = User.objects.get(username__iexact=username)
            username = actual_user.username
        except User.DoesNotExist:
            pass

        user = authenticate(request, username=username, password=password)
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
def me(request):
    u = request.user
    return Response({"id": u.id, "username": u.username, "role": u.role})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
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
@permission_classes([IsAuthenticated])
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