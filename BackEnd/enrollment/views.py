from decimal import Decimal
from datetime import date

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.conf import settings
from django.utils.text import slugify
from django.utils import timezone
from django.db import transaction
from django.db.models import Max

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import User, UserProfile, Section
from .models import EnrollmentSettings, Enrollment
from .serializers import (
    EnrollmentSettingsSerializer,
    EnrollmentSerializer,
    EnrollmentDetailedSerializer,
    EnrollmentCreateSerializer,
)

from finance.models import Transaction, TuitionConfig


class EnrollmentSettingsView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return []
        return [IsAdminUser()]

    def get(self, request):
        settings_obj = EnrollmentSettings.get_solo()
        serializer = EnrollmentSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def patch(self, request):
        settings_obj = EnrollmentSettings.get_solo()
        serializer = EnrollmentSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EnrollmentViewSet(viewsets.ModelViewSet):
    queryset = Enrollment.objects.select_related(
        "student", "section", "parent_info", "parent_user"
    ).all()

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
        queryset = Enrollment.objects.select_related(
            "student", "section", "parent_info", "parent_user"
        ).all()

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

    def generate_reference_number(self):
        year = timezone.now().year
        last = Transaction.objects.order_by("-id").first()
        seq = (last.id + 1) if last else 1
        return f"CESI-{year}-{seq:05d}"

    @staticmethod
    def _grade_code_to_section_level(grade_code: str):
        mapping = {
            "kinder": 0,
            "grade1": 1,
            "grade2": 2,
            "grade3": 3,
            "grade4": 4,
            "grade5": 5,
            "grade6": 6,
        }
        return mapping.get((grade_code or "").strip().lower())

    @staticmethod
    def _semester_from_date(dt):
        return "1st" if dt.month in [6, 7, 8, 9, 10] else "2nd"

    def _student_full_name(self, enrollment):
        return " ".join(
            p for p in [
                enrollment.first_name or "",
                enrollment.middle_name or "",
                enrollment.last_name or "",
            ] if p
        ).strip()

    def _build_installment_schedule(self, tuition):
        items = []

        initial = Decimal(str(tuition.initial or 0))
        monthly = Decimal(str(tuition.monthly or 0))
        misc_aug = Decimal(str(tuition.misc_aug or 0))
        misc_nov = Decimal(str(tuition.misc_nov or 0))

        initial_due = date(2026, 5, 31)
        if initial > 0:
            items.append({
                "item": "INITIAL",
                "description": "Initial Tuition Billing",
                "amount": initial,
                "transaction_date": initial_due,
                "due_date": initial_due,
                "semester": self._semester_from_date(initial_due),
            })

        months = [
            ("June", date(2026, 6, 30)),
            ("July", date(2026, 7, 31)),
            ("August", date(2026, 8, 31)),
            ("September", date(2026, 9, 30)),
            ("October", date(2026, 10, 31)),
            ("November", date(2026, 11, 30)),
            ("December", date(2026, 12, 31)),
            ("January", date(2027, 1, 31)),
            ("February", date(2027, 2, 28)),
            ("March", date(2027, 3, 31)),
        ]

        if monthly > 0:
            for label, due in months:
                items.append({
                    "item": "MONTHLY",
                    "description": f"{label} Installment",
                    "amount": monthly,
                    "transaction_date": due,
                    "due_date": due,
                    "semester": self._semester_from_date(due),
                })

        if misc_aug > 0:
            due = date(2026, 8, 31)
            items.append({
                "item": "MISC",
                "description": "Miscellaneous (August)",
                "amount": misc_aug,
                "transaction_date": due,
                "due_date": due,
                "semester": self._semester_from_date(due),
            })

        if misc_nov > 0:
            due = date(2026, 11, 30)
            items.append({
                "item": "MISC",
                "description": "Miscellaneous (November)",
                "amount": misc_nov,
                "transaction_date": due,
                "due_date": due,
                "semester": self._semester_from_date(due),
            })

        return items

    def _recompute_parent_ledger_balances(self, parent_user):
        rows = Transaction.objects.filter(parent=parent_user).order_by(
            "transaction_date", "date_posted", "id"
        )

        running = Decimal("0.00")
        for row in rows:
            running += Decimal(str(row.debit or 0)) - Decimal(str(row.credit or 0))
            if row.balance != running:
                row.balance = running
                row.save(update_fields=["balance"])

    def _ledger_exists_for_enrollment(self, enrollment):
        if not enrollment.parent_user:
            return False

        student_name = self._student_full_name(enrollment)
        school_year = enrollment.academic_year or ""

        return Transaction.objects.filter(
            parent=enrollment.parent_user,
            student_name=student_name,
            school_year=school_year,
            transaction_type="TUITION",
            item__in=["REGISTRATION", "INITIAL"],
        ).exists()

    def _create_transaction(
        self,
        *,
        parent_user,
        student_name,
        school_year,
        semester,
        transaction_type,
        entry_type,
        item,
        amount,
        description,
        payment_method="CASH",
        transaction_date=None,
        due_date=None,
        status_value="POSTED",
    ):
        tx = Transaction.objects.create(
            parent=parent_user,
            student_name=student_name,
            school_year=school_year,
            semester=semester,
            transaction_type=transaction_type,
            entry_type=entry_type,
            item=item,
            amount=Decimal(str(amount or 0)),
            description=description,
            payment_method=payment_method,
            reference_number=self.generate_reference_number(),
            transaction_date=transaction_date or timezone.localdate(),
            due_date=due_date,
            status=status_value,
        )
        return tx

    def _create_finance_ledger_for_enrollment(self, enrollment):
        if not enrollment.parent_user:
            return

        if self._ledger_exists_for_enrollment(enrollment):
            return

        grade_key = (enrollment.grade_level or "").strip().lower()
        payment_mode = (enrollment.payment_mode or "").strip().lower()
        school_year = enrollment.academic_year or ""
        student_name = self._student_full_name(enrollment)

        tuition = TuitionConfig.objects.filter(
            grade_key=grade_key,
            is_active=True,
            status="active",
        ).first()

        if not tuition:
            return

        today = timezone.localdate()
        semester = self._semester_from_date(today)

        if payment_mode == "cash":
            total_cash = Decimal(str(tuition.total_cash or 0))

            self._create_transaction(
                parent_user=enrollment.parent_user,
                student_name=student_name,
                school_year=school_year,
                semester=semester,
                transaction_type="TUITION",
                entry_type="DEBIT",
                item="REGISTRATION",
                amount=total_cash,
                description="Cash Tuition Billing",
                payment_method="CASH",
                transaction_date=today,
                due_date=None,
                status_value="POSTED",
            )

            self._create_transaction(
                parent_user=enrollment.parent_user,
                student_name=student_name,
                school_year=school_year,
                semester=semester,
                transaction_type="TUITION",
                entry_type="CREDIT",
                item="PAYMENT",
                amount=total_cash,
                description="Cash Tuition Payment",
                payment_method="CASH",
                transaction_date=today,
                due_date=None,
                status_value="PAID",
            )

        elif payment_mode == "installment":
            schedule = self._build_installment_schedule(tuition)

            for sched in schedule:
                debit_status = "POSTED" if sched["item"] == "INITIAL" else "PENDING"

                self._create_transaction(
                    parent_user=enrollment.parent_user,
                    student_name=student_name,
                    school_year=school_year,
                    semester=sched["semester"],
                    transaction_type="TUITION",
                    entry_type="DEBIT",
                    item=sched["item"],
                    amount=sched["amount"],
                    description=sched["description"],
                    payment_method="CASH",
                    transaction_date=sched["transaction_date"],
                    due_date=sched["due_date"],
                    status_value=debit_status,
                )

            initial = Decimal(str(tuition.initial or 0))
            if initial > 0:
                initial_due = date(2026, 5, 31)
                self._create_transaction(
                    parent_user=enrollment.parent_user,
                    student_name=student_name,
                    school_year=school_year,
                    semester=self._semester_from_date(initial_due),
                    transaction_type="TUITION",
                    entry_type="CREDIT",
                    item="INITIAL",
                    amount=initial,
                    description="Initial Tuition Payment",
                    payment_method="CASH",
                    transaction_date=today,
                    due_date=initial_due,
                    status_value="PAID",
                )

        self._recompute_parent_ledger_balances(enrollment.parent_user)

    @staticmethod
    def _sync_enrollment_to_profile(enrollment):
        parent_user = enrollment.parent_user
        if not parent_user:
            return
        profile = UserProfile.objects.filter(user=parent_user).first()
        if not profile:
            return

        changed = False
        if enrollment.grade_level and profile.grade_level != enrollment.grade_level:
            profile.grade_level = enrollment.grade_level
            changed = True
        if enrollment.section_id != profile.section_id:
            profile.section_id = enrollment.section_id
            changed = True
        if enrollment.student_number and profile.student_number != enrollment.student_number:
            profile.student_number = enrollment.student_number
            changed = True
        if enrollment.payment_mode and profile.payment_mode != enrollment.payment_mode:
            profile.payment_mode = enrollment.payment_mode
            changed = True
        if changed:
            profile.save()

    def _get_parent_names_from_enrollment(self, enrollment):
        parent_info = getattr(enrollment, "parent_info", None)

        guardian_full = ""
        if parent_info:
            guardian_full = (
                parent_info.guardian_name
                or parent_info.mother_name
                or parent_info.father_name
                or ""
            ).strip()

        parts = guardian_full.split()
        parent_first_name = parts[0] if parts else ""
        parent_last_name = " ".join(parts[1:]) if len(parts) > 1 else ""

        return parent_first_name, parent_last_name

    def _sync_parent_user_and_profile(self, enrollment, create_if_missing=False, uploaded_id_image=None):
        parent_email = (enrollment.email or "").strip().lower()
        parent_user = enrollment.parent_user

        if not parent_user and create_if_missing and parent_email:
            parent_user = User.objects.filter(email__iexact=parent_email).first()

            if not parent_user:
                base_username = f"{(enrollment.first_name or '')}{(enrollment.last_name or '')}".lower()
                base_username = slugify(base_username).replace("-", "") or "parent"

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

            enrollment.parent_user = parent_user
            enrollment.save(update_fields=["parent_user"])

        if not parent_user:
            return

        grade_code = (enrollment.grade_level or "").strip()
        parent_first_name, parent_last_name = self._get_parent_names_from_enrollment(enrollment)

        if parent_email and parent_user.email != parent_email:
            email_taken = (
                User.objects
                .filter(email__iexact=parent_email)
                .exclude(pk=parent_user.pk)
                .exists()
            )
            if not email_taken:
                parent_user.email = parent_email
                parent_user.save(update_fields=["email"])

        profile, created = UserProfile.objects.get_or_create(
            user=parent_user,
            defaults={
                "student_first_name": enrollment.first_name or "",
                "student_middle_name": enrollment.middle_name or "",
                "student_last_name": enrollment.last_name or "",
                "grade_level": grade_code,
                "lrn": enrollment.lrn or "",
                "student_number": enrollment.student_number or "",
                "payment_mode": enrollment.payment_mode or "",
                "section": enrollment.section,
                "parent_first_name": parent_first_name,
                "parent_middle_name": "",
                "parent_last_name": parent_last_name,
                "contact_number": enrollment.mobile_number or enrollment.telephone_number or "",
                "address": enrollment.address or "",
            },
        )

        if not created:
            profile.student_first_name = enrollment.first_name or profile.student_first_name
            profile.student_middle_name = enrollment.middle_name or profile.student_middle_name
            profile.student_last_name = enrollment.last_name or profile.student_last_name
            profile.grade_level = grade_code or profile.grade_level
            profile.lrn = enrollment.lrn or profile.lrn
            profile.student_number = enrollment.student_number or profile.student_number
            profile.payment_mode = enrollment.payment_mode or profile.payment_mode
            profile.section = enrollment.section
            profile.parent_first_name = parent_first_name or profile.parent_first_name
            profile.parent_last_name = parent_last_name or profile.parent_last_name
            profile.contact_number = (
                enrollment.mobile_number
                or enrollment.telephone_number
                or profile.contact_number
            )
            profile.address = enrollment.address or profile.address

        if uploaded_id_image:
            profile.avatar = uploaded_id_image

        profile.save()

    def _send_parent_portal_email(self, enrollment, parent_email):
        if not enrollment.parent_user:
            return

        uidb64 = urlsafe_base64_encode(force_bytes(enrollment.parent_user.pk))
        token = default_token_generator.make_token(enrollment.parent_user)

        frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        reset_url = f"{frontend_base}/set-password/{uidb64}/{token}"

        send_mail(
            subject="Your Student Portal Account",
            message=(
                f"Student: {enrollment.first_name} {enrollment.last_name}\n\n"
                f"Username: {enrollment.parent_user.username}\n"
                f"Email:    {enrollment.parent_user.email}\n\n"
                f"Student Number: {enrollment.student_number}\n\n"
                f"Set your password here:\n{reset_url}\n\n"
                "If you did not request this, ignore this email."
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
            recipient_list=[parent_email],
            fail_silently=False,
        )

    def _send_promotion_email(self, enrollment, parent_email, grade_code):
        send_mail(
            subject="Student Promotion Confirmed",
            message=(
                f"Dear Parent/Guardian,\n\n"
                f"This is to confirm that {enrollment.first_name} {enrollment.last_name} "
                f"has been successfully promoted.\n\n"
                f"New Grade Level : {grade_code}\n"
                f"Academic Year   : {enrollment.academic_year}\n"
                f"Student No.     : {enrollment.student_number}\n\n"
                f"You may log in to the Student Portal to view the updated enrollment.\n\n"
                "If you have any questions, please contact the school."
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
            recipient_list=[parent_email],
            fail_silently=False,
        )

    def perform_update(self, serializer):
        enrollment = serializer.save()
        uploaded_id_image = self.request.FILES.get("id_image")

        if uploaded_id_image:
            enrollment.id_image = uploaded_id_image
            enrollment.save(update_fields=["id_image", "updated_at"])

        self._sync_parent_user_and_profile(
            enrollment,
            create_if_missing=False,
            uploaded_id_image=uploaded_id_image,
        )
        self._sync_enrollment_to_profile(enrollment)

    # ------------------- Custom Actions -------------------

    @action(detail=False, methods=["get"])
    def by_student(self, request):
        student_id = request.query_params.get("student_id")
        if not student_id:
            return Response(
                {"error": "student_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        enrollments = Enrollment.objects.filter(student_id=student_id)
        serializer = self.get_serializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_section(self, request):
        section_id = request.query_params.get("section_id")
        if not section_id:
            return Response(
                {"error": "section_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        enrollments = Enrollment.objects.filter(section_id=section_id)
        serializer = self.get_serializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_grade(self, request):
        grade_level = request.query_params.get("grade_level")
        if not grade_level:
            return Response(
                {"error": "grade_level query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
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

        if enrollment.parent_user_id:
            profile = getattr(enrollment.parent_user, "profile", None)
            if profile:
                profile.section = None
                profile.save(update_fields=["section"])

        serializer = self.get_serializer(enrollment)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def mark_active(self, request, pk=None):
        enrollment = self.get_object()

        grade_code = (enrollment.grade_level or "").strip()
        valid_grades = {
            "prek", "kinder", "grade1", "grade2",
            "grade3", "grade4", "grade5", "grade6"
        }

        if grade_code not in valid_grades:
            return Response(
                {"detail": f"Invalid grade_level on enrollment: {enrollment.grade_level}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        required_missing = []

        if not enrollment.first_name:
            required_missing.append("first_name")
        if not enrollment.last_name:
            required_missing.append("last_name")
        if not enrollment.birth_date:
            required_missing.append("birth_date")
        if not enrollment.education_level:
            required_missing.append("education_level")
        if not enrollment.grade_level:
            required_missing.append("grade_level")
        if not enrollment.student_type:
            required_missing.append("student_type")
        if not enrollment.academic_year:
            required_missing.append("academic_year")
        if not enrollment.payment_mode:
            required_missing.append("payment_mode")
        if not enrollment.parent_facebook:
            required_missing.append("parent_facebook")

        if not (enrollment.email or enrollment.mobile_number or enrollment.telephone_number):
            required_missing.append("contact")

        if grade_code in {"kinder", "grade1", "grade2", "grade3", "grade4", "grade5", "grade6"}:
            if not enrollment.lrn:
                required_missing.append("lrn")
            elif len(str(enrollment.lrn).strip()) != 12:
                return Response(
                    {"detail": "LRN must be exactly 12 digits before approval."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if required_missing:
            return Response(
                {"detail": f"Cannot approve. Missing required fields: {', '.join(required_missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_promotion = (enrollment.student_type or "").strip().lower() == "old"
        parent_email = (enrollment.email or "").strip().lower()
        uploaded_id_image = request.FILES.get("id_image")

        section_id = request.data.get("section")
        if section_id:
            try:
                enrollment.section = Section.objects.get(pk=section_id)
            except Section.DoesNotExist:
                return Response(
                    {"detail": "Selected section not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            if enrollment.section_id is None:
                section_level = self._grade_code_to_section_level(grade_code)
                if section_level is not None:
                    auto_section = (
                        Section.objects
                        .filter(grade_level=section_level)
                        .order_by("id")
                        .first()
                    )
                    if auto_section:
                        enrollment.section = auto_section

            if not enrollment.student_number:
                while True:
                    candidate = self.generate_student_number()
                    if not Enrollment.objects.filter(student_number=candidate).exists():
                        enrollment.student_number = candidate
                        break

            enrollment.status = "ACTIVE"

            if uploaded_id_image:
                enrollment.id_image = uploaded_id_image

            note = "APPROVED BY ADMIN"
            enrollment.remarks = (enrollment.remarks or "").strip()
            if note not in enrollment.remarks:
                enrollment.remarks = f"{enrollment.remarks} | {note}".strip(" |")

            update_fields = ["status", "remarks", "updated_at", "student_number"]
            if uploaded_id_image:
                update_fields.append("id_image")
            if enrollment.section is not None:
                update_fields.append("section")

            enrollment.save(update_fields=update_fields)

            if parent_email:
                existing_user = User.objects.filter(email__iexact=parent_email).first()
                had_existing_user = existing_user is not None

                if existing_user and not enrollment.parent_user:
                    enrollment.parent_user = existing_user
                    enrollment.save(update_fields=["parent_user"])

                self._sync_parent_user_and_profile(
                    enrollment,
                    create_if_missing=True,
                    uploaded_id_image=uploaded_id_image,
                )
                enrollment.refresh_from_db()

                if enrollment.parent_user:
                    if is_promotion and had_existing_user:
                        self._send_promotion_email(enrollment, parent_email, grade_code)
                    else:
                        self._send_parent_portal_email(enrollment, parent_email)

            self._sync_enrollment_to_profile(enrollment)

            if enrollment.parent_user:
                self._create_finance_ledger_for_enrollment(enrollment)

        serializer = self.get_serializer(enrollment)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def active_enrollments(self, request):
        enrollments = Enrollment.objects.filter(status="ACTIVE")
        serializer = self.get_serializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def statistics(self, request):
        total_enrollments = Enrollment.objects.count()
        active_enrollments = Enrollment.objects.filter(status="ACTIVE").count()
        completed_enrollments = Enrollment.objects.filter(status="COMPLETED").count()
        dropped_enrollments = Enrollment.objects.filter(status="DROPPED").count()
        pending_enrollments = Enrollment.objects.filter(status="PENDING").count()

        by_grade = {}
        grade_map = {
            "prek": "Pre-Kinder",
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
            "total_enrollments": total_enrollments,
            "active_enrollments": active_enrollments,
            "completed_enrollments": completed_enrollments,
            "dropped_enrollments": dropped_enrollments,
            "pending_enrollments": pending_enrollments,
            "by_grade": by_grade,
        })