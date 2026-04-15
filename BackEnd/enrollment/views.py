from decimal import Decimal
from datetime import date
import logging
from urllib import request

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.conf import settings
from django.utils.text import slugify
from django.utils import timezone
from django.db import transaction
from django.db.models import Max, Sum

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import redirect
from django.http import HttpResponse, Http404

from accounts.models import User, UserProfile, Section
from .models import EnrollmentSettings, Enrollment, EnrollmentDocument, ParentInfo
from .serializers import (
    EnrollmentSettingsSerializer,
    EnrollmentSerializer,
    EnrollmentDetailedSerializer,
    EnrollmentCreateSerializer,
    OldStudentLookupSerializer,
)
from finance.models import Transaction, TuitionConfig, ProofOfPayment


logger = logging.getLogger(__name__)


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
        serializer = EnrollmentSettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EnrollmentViewSet(viewsets.ModelViewSet):
    queryset = Enrollment.objects.select_related(
        "student", "section", "parent_info", "parent_user"
    ).prefetch_related("documents").all()

    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ["create", "lookup_student"]:
            return [AllowAny()]
        if self.action in ["submit_reenrollment"]:
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "enrollment_public"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return EnrollmentCreateSerializer
        if self.action in [
            "retrieve",
            "mark_completed",
            "mark_dropped",
            "mark_active",
            "submit_reenrollment",
            "upload_id_image",
        ]:
            return EnrollmentDetailedSerializer
        return EnrollmentSerializer

    def get_queryset(self):
        queryset = Enrollment.objects.select_related(
            "student", "section", "parent_info", "parent_user"
        ).prefetch_related("documents").all()

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

    # ------------------- Public / Student Actions -------------------

    @action(detail=False, methods=["post"], permission_classes=[AllowAny], url_path="lookup-student")
    def lookup_student(self, request):
        serializer = OldStudentLookupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data["identifier"].strip()
        identifier_type = serializer.validated_data.get("identifier_type", "auto")

        profiles = UserProfile.objects.select_related("user").filter(
            user__role="PARENT_STUDENT",
            user__is_active=True,
        )

        profile = None
        match_type = None

        if identifier_type in ["lrn", "auto"]:
            profile = profiles.filter(lrn=identifier).first()
            if profile:
                match_type = "lrn"

        if not profile and identifier_type in ["student_number", "auto"]:
            profile = profiles.filter(student_number=identifier).first()
            if profile:
                match_type = "student_number"

        if not profile:
            return Response(
                {
                    "found": False,
                    "message": "No existing student record found. You may proceed as New / Transferee.",
                },
                status=status.HTTP_200_OK,
            )

        student_name = " ".join(
            part
            for part in [
                profile.student_first_name or "",
                profile.student_middle_name or "",
                profile.student_last_name or "",
            ]
            if part
        ).strip()

        return Response(
            {
                "found": True,
                "match_type": match_type,
                "student_name": student_name,
                "message": "Existing student record found. Please log in to continue re-enrollment.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated], url_path="submit-reenrollment")
    def submit_reenrollment(self, request):
        user = request.user

        if str(getattr(user, "role", "")).upper() != "PARENT_STUDENT":
            return Response(
                {"detail": "Only Parent/Student accounts can submit re-enrollment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile = UserProfile.objects.filter(user=user).first()
        if not profile:
            return Response(
                {"detail": "Student profile not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        settings_obj = EnrollmentSettings.get_solo()
        academic_year = (settings_obj.academic_year or "").strip()

        if not academic_year:
            return Response(
                {"detail": "Enrollment academic year is not configured."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        balance_block = self._ensure_old_student_has_no_balance(user)
        if balance_block:
            return balance_block

        latest_enrollment = (
            Enrollment.objects.filter(parent_user=user)
            .select_related("parent_info")
            .order_by("-created_at", "-id")
            .first()
        )

        if not latest_enrollment:
            return Response(
                {"detail": "No previous enrollment record found for re-enrollment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_grade = (profile.grade_level or latest_enrollment.grade_level or "").strip().lower()
        next_grade = self._next_grade_level(current_grade)

        if not current_grade:
            return Response(
                {"detail": "Grade level is missing from the current student record."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not next_grade:
            return Response(
                {"detail": "Congratulations! Grade 6 students are already completed and cannot re-enroll."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_same_year = Enrollment.objects.filter(
            parent_user=user,
            academic_year=academic_year,
            status__in=["PENDING", "ACTIVE"],
        ).exists()

        if existing_same_year:
            return Response(
                {"detail": "You already have an enrollment application for this school year."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_mode = (
            request.data.get("payment_mode")
            or profile.payment_mode
            or latest_enrollment.payment_mode
            or ""
        ).strip().lower()

        if payment_mode not in ["cash", "installment"]:
            return Response(
                {"detail": "Valid payment mode is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student_first_name = (
            request.data.get("student_first_name")
            or profile.student_first_name
            or latest_enrollment.first_name
            or ""
        ).strip()
        student_middle_name = (
            request.data.get("student_middle_name")
            or profile.student_middle_name
            or latest_enrollment.middle_name
            or ""
        ).strip()
        student_last_name = (
            request.data.get("student_last_name")
            or profile.student_last_name
            or latest_enrollment.last_name
            or ""
        ).strip()

        parent_first_name = (request.data.get("parent_first_name") or "").strip()
        parent_middle_name = (request.data.get("parent_middle_name") or "").strip()
        parent_last_name = (request.data.get("parent_last_name") or "").strip()

        contact_number = (
            request.data.get("contact_number")
            or profile.contact_number
            or latest_enrollment.mobile_number
            or ""
        ).strip()
        address = (
            request.data.get("address")
            or profile.address
            or latest_enrollment.address
            or ""
        ).strip()
        remarks = (request.data.get("remarks") or "").strip()

        if not student_first_name or not student_last_name:
            return Response(
                {"detail": "Student first name and last name are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not contact_number:
            return Response(
                {"detail": "Contact number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not address:
            return Response(
                {"detail": "Address is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        latest_parent_info = getattr(latest_enrollment, "parent_info", None)

        with transaction.atomic():
            new_enrollment = Enrollment.objects.create(
                student=user,
                parent_user=user,
                student_type="old",
                status="PENDING",
                education_level=self._education_level_from_grade(next_grade),
                grade_level=next_grade,
                academic_year=academic_year,
                payment_mode=payment_mode,
                lrn=profile.lrn or latest_enrollment.lrn,
                student_number=None,
                first_name=student_first_name,
                middle_name=student_middle_name,
                last_name=student_last_name,
                birth_date=latest_enrollment.birth_date,
                gender=latest_enrollment.gender,
                email=latest_enrollment.email,
                address=address,
                religion=latest_enrollment.religion,
                telephone_number=latest_enrollment.telephone_number,
                mobile_number=contact_number,
                parent_facebook=latest_enrollment.parent_facebook,
                section=None,
                remarks=(f"{remarks} | RE-ENROLLMENT APPLICATION").strip(" |"),
            )

            ParentInfo.objects.create(
                enrollment=new_enrollment,
                father_name=latest_parent_info.father_name if latest_parent_info else "",
                father_contact=latest_parent_info.father_contact if latest_parent_info else "",
                father_occupation=latest_parent_info.father_occupation if latest_parent_info else "",
                mother_name=latest_parent_info.mother_name if latest_parent_info else "",
                mother_contact=latest_parent_info.mother_contact if latest_parent_info else "",
                mother_occupation=latest_parent_info.mother_occupation if latest_parent_info else "",
                guardian_name=" ".join(
                    p for p in [parent_first_name, parent_middle_name, parent_last_name] if p
                ).strip() or (latest_parent_info.guardian_name if latest_parent_info else ""),
                guardian_contact=contact_number or (latest_parent_info.guardian_contact if latest_parent_info else ""),
                guardian_relationship=latest_parent_info.guardian_relationship if latest_parent_info else "",
            )

            self._save_optional_documents(new_enrollment, request.FILES)

            previous_active = (
                Enrollment.objects.filter(parent_user=user, status="ACTIVE")
                .exclude(pk=new_enrollment.pk)
                .order_by("-created_at", "-id")
                .first()
            )

            if previous_active:
                previous_active.status = "COMPLETED"
                previous_active.completed_at = timezone.now()
                previous_active.remarks = (
                    f"{(previous_active.remarks or '').strip()} | "
                    f"AUTO-COMPLETED AFTER RE-ENROLLMENT SUBMISSION"
                ).strip(" |")
                previous_active.save(
                    update_fields=["status", "completed_at", "remarks", "updated_at"]
                )

        serializer = EnrollmentDetailedSerializer(new_enrollment, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ------------------- Helpers -------------------

    def _next_grade_level(self, current_grade):
        mapping = {
            "prek": "kinder",
            "kinder": "grade1",
            "grade1": "grade2",
            "grade2": "grade3",
            "grade3": "grade4",
            "grade4": "grade5",
            "grade5": "grade6",
            "grade6": None,
        }
        return mapping.get((current_grade or "").strip().lower())

    def _current_outstanding_balance_for_parent(self, parent_user):
        totals = Transaction.objects.filter(parent=parent_user).aggregate(
            total_debit=Sum("debit"),
            total_credit=Sum("credit"),
        )

        total_debit = Decimal(str(totals.get("total_debit") or 0))
        total_credit = Decimal(str(totals.get("total_credit") or 0))

        balance = total_debit - total_credit
        return balance if balance > 0 else Decimal("0.00")

    def _ensure_old_student_has_no_balance(self, parent_user):
        balance = self._current_outstanding_balance_for_parent(parent_user)
        if balance > 0:
            return Response(
                {
                    "detail": (
                        f"Cannot continue re-enrollment. Outstanding balance: "
                        f"₱{balance:,.2f}. Please settle the previous balance first."
                    ),
                    "outstanding_balance": f"{balance:.2f}",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def _education_level_from_grade(self, grade_code):
        grade_code = (grade_code or "").strip().lower()
        if grade_code in {"prek", "kinder"}:
            return "preschool"
        return "elementary"

    def _save_optional_documents(self, enrollment, files):
        mapping = {
            "form_137_file": ("form_137", "Form 137-E"),
            "sf10_file": ("sf10", "School Form 10 (SF10)"),
            "birth_certificate_file": ("birth_certificate", "Birth Certificate"),
            "good_moral_file": ("good_moral", "Good Moral Certificate"),
            "report_card_file": ("report_card", "Report Card"),
            "other_document_file": ("other", "Other Document"),
        }

        for field_name, (doc_type, label) in mapping.items():
            uploaded = files.get(field_name)
            if uploaded:
                EnrollmentDocument.objects.create(
                    enrollment=enrollment,
                    document_type=doc_type,
                    file=uploaded,
                    label=label,
                )

    def _create_proof_of_payment(self, enrollment, proof_file, payment_amount=None):
        """Create a ProofOfPayment record from enrollment proof file."""
        if not proof_file:
            return
        
        from finance.models import ProofOfPayment
        
        # Get student name from enrollment (not from user)
        student_name = f"{enrollment.first_name} {enrollment.last_name}".strip()
        
        try:
            submitted_amount = Decimal(str(payment_amount or 0))
        except Exception:
            submitted_amount = Decimal("0")

        if submitted_amount < 0:
            submitted_amount = Decimal("0")

        ProofOfPayment.objects.create(
            user=enrollment.parent_user or enrollment.student,
            enrollment=enrollment,  # Link to enrollment
            reference_number=f"ENROLL-{enrollment.id}",
            description=f"Enrollment Initial Payment - {student_name}",
            amount=submitted_amount,
            billed_item='REGISTRATION',  # Enrollment registration bill type
            proof_image=proof_file,
            payment_type='enrollment',
            source='enrollment_form',
            status='pending'
        )

    def perform_create(self, serializer):
        enrollment = serializer.save()
        files = serializer.context.get('_files', {})
        self._save_optional_documents(enrollment, files)
        self._create_proof_of_payment(
            enrollment,
            files.get('payment_proof_file'),
            files.get('payment_amount'),
        )

    def perform_update(self, serializer):
        enrollment = serializer.save()
        files = serializer.context.get('_files', {})
        self._save_optional_documents(enrollment, files)
        self._create_proof_of_payment(
            enrollment,
            files.get('payment_proof_file'),
            files.get('payment_amount'),
        )

    def generate_student_number(self):
        year = timezone.now().year
        prefix = str(year)

        last = (
            Enrollment.objects.filter(student_number__startswith=prefix)
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
            p
            for p in [
                enrollment.first_name or "",
                enrollment.middle_name or "",
                enrollment.last_name or "",
            ]
            if p
        ).strip()

    def _build_installment_schedule(self, tuition, posted_date, include_assessment=False):
        items = []

        initial = Decimal(str(tuition.initial or 0))
        monthly = Decimal(str(tuition.monthly or 0))
        misc_aug = Decimal(str(tuition.misc_aug or 0))
        misc_nov = Decimal(str(tuition.misc_nov or 0))

        # Calculate year from current date for dynamic scheduling
        current_year = timezone.now().year
        
        # Initial payment due in May of current year
        initial_due = date(current_year, 5, 31)
        if initial > 0:
            items.append({
                "item": "INITIAL",
                "description": "Initial Tuition Billing",
                "amount": initial,
                "transaction_date": posted_date,
                "due_date": initial_due,
                "semester": self._semester_from_date(initial_due),
            })

        assessment = Decimal(str(tuition.assessment or 0)) if include_assessment else Decimal("0.00")
        if assessment > 0:
            items.append({
                "item": "ASSESSMENT",
                "description": "Assessment Fee Billing",
                "amount": assessment,
                "transaction_date": posted_date,
                "due_date": initial_due,
                "semester": self._semester_from_date(initial_due),
            })

        # Monthly installments from June to March
        months = [
            ("June", date(current_year, 6, 30)),
            ("July", date(current_year, 7, 31)),
            ("August", date(current_year, 8, 31)),
            ("September", date(current_year, 9, 30)),
            ("October", date(current_year, 10, 31)),
            ("November", date(current_year, 11, 30)),
            ("December", date(current_year, 12, 31)),
            ("January", date(current_year + 1, 1, 31)),
            ("February", date(current_year + 1, 2, 28)),
            ("March", date(current_year + 1, 3, 31)),
        ]

        installment = Decimal(str(tuition.installment or 0))
        scheduled_installment = initial + (monthly * Decimal("10"))
        installment_adjustment = installment - scheduled_installment

        if monthly > 0:
            for label, due in months:
                month_amount = monthly
                if label == "March":
                    month_amount += installment_adjustment
                    if month_amount < 0:
                        month_amount = Decimal("0.00")

                if month_amount == 0:
                    continue

                items.append({
                    "item": "MONTHLY",
                    "description": f"{label} Installment",
                    "amount": month_amount,
                    "transaction_date": posted_date,
                    "due_date": due,
                    "semester": self._semester_from_date(due),
                })

        # Miscellaneous fees with dynamic year
        if misc_aug > 0:
            due = date(current_year, 8, 31)
            items.append({
                "item": "MISC",
                "description": "Miscellaneous (August)",
                "amount": misc_aug,
                "transaction_date": posted_date,
                "due_date": due,
                "semester": self._semester_from_date(due),
            })

        if misc_nov > 0:
            due = date(current_year, 11, 30)
            items.append({
                "item": "MISC",
                "description": "Miscellaneous (November)",
                "amount": misc_nov,
                "transaction_date": posted_date,
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

        return Transaction.objects.filter(
            parent=enrollment.parent_user,
            enrollment=enrollment,
            transaction_type="TUITION",
        ).exists()

    def _get_effective_student_number(self, enrollment):
        if enrollment.student_number:
            return enrollment.student_number

        if enrollment.parent_user:
            profile = UserProfile.objects.filter(user=enrollment.parent_user).first()
            if profile and profile.student_number:
                return profile.student_number

        return ""

    def _create_transaction(
        self,
        *,
        enrollment,
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
        reference_number=None,
    ):
        effective_student_number = self._get_effective_student_number(enrollment)

        return Transaction.objects.create(
            parent=parent_user,
            enrollment=enrollment,
            student_name=student_name,
            student_number_snapshot=effective_student_number,
            grade_level_snapshot=enrollment.grade_level or "",
            payment_mode_snapshot=enrollment.payment_mode or "",
            student_type_snapshot=enrollment.student_type or "",
            school_year=school_year,
            semester=semester,
            transaction_type=transaction_type,
            entry_type=entry_type,
            item=item,
            amount=Decimal(str(amount or 0)),
            description=description,
            payment_method=payment_method,
            reference_number=reference_number or self.generate_reference_number(),
            transaction_date=transaction_date or timezone.localdate(),
            due_date=due_date,
            status=status_value,
        )

    def _ensure_new_student_assessment_debit(
        self,
        *,
        enrollment,
        tuition,
        school_year,
        student_name,
    ):
        if not enrollment.parent_user:
            return False

        is_new_student = (enrollment.student_type or "").strip().lower() == "new"
        if not is_new_student:
            return False

        assessment = Decimal(str(tuition.assessment or 0))
        if assessment <= 0:
            return False

        assessment_exists = Transaction.objects.filter(
            parent=enrollment.parent_user,
            enrollment=enrollment,
            transaction_type="TUITION",
            entry_type="DEBIT",
            item="ASSESSMENT",
        ).exists()
        if assessment_exists:
            return False

        payment_mode = (enrollment.payment_mode or "").strip().lower()
        today = timezone.localdate()

        due_date = None
        semester = self._semester_from_date(today)
        status_value = "POSTED"

        if payment_mode == "installment":
            current_year = today.year
            due_date = date(current_year, 5, 31)
            semester = self._semester_from_date(due_date)
            status_value = "PENDING"

        self._create_transaction(
            enrollment=enrollment,
            parent_user=enrollment.parent_user,
            student_name=student_name,
            school_year=school_year,
            semester=semester,
            transaction_type="TUITION",
            entry_type="DEBIT",
            item="ASSESSMENT",
            amount=assessment,
            description="Assessment Fee Billing",
            payment_method="CASH",
            transaction_date=today,
            due_date=due_date,
            status_value=status_value,
        )

        return True

    def _create_finance_ledger_for_enrollment(self, enrollment):
        if not enrollment.parent_user:
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

        if self._ledger_exists_for_enrollment(enrollment):
            created = self._ensure_new_student_assessment_debit(
                enrollment=enrollment,
                tuition=tuition,
                school_year=school_year,
                student_name=student_name,
            )
            if created:
                self._recompute_parent_ledger_balances(enrollment.parent_user)
            return

        is_new_student = (enrollment.student_type or "").strip().lower() == "new"

        today = timezone.localdate()
        semester = self._semester_from_date(today)

        if payment_mode == "cash":
            cash = Decimal(str(tuition.cash or 0))
            reservation_fee = Decimal(str(tuition.reservation_fee or 0))
            assessment = Decimal(str(tuition.assessment or 0)) if is_new_student else Decimal("0.00")
            misc_aug = Decimal(str(tuition.misc_aug or 0))
            misc_nov = Decimal(str(tuition.misc_nov or 0))
            total_cash = Decimal(str(tuition.total_cash or 0))

            # total_cash is cash + misc fees from TuitionConfig; for new students,
            # assessment must be added on top as a separate debit (not deducted here).
            tuition_only = total_cash - reservation_fee - misc_aug - misc_nov
            if tuition_only < 0:
                tuition_only = cash if cash > 0 else Decimal("0.00")

            if reservation_fee > 0:
                self._create_transaction(
                    enrollment=enrollment,
                    parent_user=enrollment.parent_user,
                    student_name=student_name,
                    school_year=school_year,
                    semester=semester,
                    transaction_type="TUITION",
                    entry_type="DEBIT",
                    item="RESERVATION",
                    amount=reservation_fee,
                    description="Reservation Fee Billing",
                    payment_method="CASH",
                    transaction_date=today,
                    due_date=None,
                    status_value="POSTED",
                )

            if assessment > 0:
                self._create_transaction(
                    enrollment=enrollment,
                    parent_user=enrollment.parent_user,
                    student_name=student_name,
                    school_year=school_year,
                    semester=semester,
                    transaction_type="TUITION",
                    entry_type="DEBIT",
                    item="ASSESSMENT",
                    amount=assessment,
                    description="Assessment Fee Billing",
                    payment_method="CASH",
                    transaction_date=today,
                    due_date=None,
                    status_value="POSTED",
                )

            if tuition_only > 0:
                self._create_transaction(
                    enrollment=enrollment,
                    parent_user=enrollment.parent_user,
                    student_name=student_name,
                    school_year=school_year,
                    semester=semester,
                    transaction_type="TUITION",
                    entry_type="DEBIT",
                    item="REGISTRATION",
                    amount=tuition_only,
                    description="Cash Tuition Billing",
                    payment_method="CASH",
                    transaction_date=today,
                    due_date=None,
                    status_value="POSTED",
                )

            if misc_aug > 0:
                current_year = timezone.now().year
                aug_due = date(current_year, 8, 31)
                self._create_transaction(
                    enrollment=enrollment,
                    parent_user=enrollment.parent_user,
                    student_name=student_name,
                    school_year=school_year,
                    semester=self._semester_from_date(aug_due),
                    transaction_type="TUITION",
                    entry_type="DEBIT",
                    item="MISC",
                    amount=misc_aug,
                    description="Miscellaneous (August)",
                    payment_method="CASH",
                    transaction_date=today,
                    due_date=aug_due,
                    status_value="POSTED",
                    reference_number=self.generate_reference_number(),
                )

            if misc_nov > 0:
                current_year = timezone.now().year
                nov_due = date(current_year, 11, 30)
                self._create_transaction(
                    enrollment=enrollment,
                    parent_user=enrollment.parent_user,
                    student_name=student_name,
                    school_year=school_year,
                    semester=self._semester_from_date(nov_due),
                    transaction_type="TUITION",
                    entry_type="DEBIT",
                    item="MISC",
                    amount=misc_nov,
                    description="Miscellaneous (November)",
                    payment_method="CASH",
                    transaction_date=today,
                    due_date=nov_due,
                    status_value="POSTED",
                    reference_number=self.generate_reference_number(),
                )
        elif payment_mode == "installment":
            schedule = self._build_installment_schedule(
                tuition,
                today,
                include_assessment=is_new_student,
            )

            for sched in schedule:
                debit_status = "POSTED" if sched["item"] == "INITIAL" else "PENDING"

                self._create_transaction(
                    enrollment=enrollment,
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

        self._ensure_new_student_assessment_debit(
            enrollment=enrollment,
            tuition=tuition,
            school_year=school_year,
            student_name=student_name,
        )

            # initial = Decimal(str(tuition.initial or 0))
            # if initial > 0:
            #     initial_due = date(2026, 5, 31)
            #     self._create_transaction(
            #         enrollment=enrollment,
            #         parent_user=enrollment.parent_user,
            #         student_name=student_name,
            #         school_year=school_year,
            #         semester=self._semester_from_date(initial_due),
            #         transaction_type="TUITION",
            #         entry_type="CREDIT",
            #         item="INITIAL",
            #         amount=initial,
            #         description="Initial Tuition Payment",
            #         payment_method="CASH",
            #         transaction_date=today,
            #         due_date=initial_due,
            #         status_value="PAID",
            #     )

        self._recompute_parent_ledger_balances(enrollment.parent_user)

    @staticmethod
    def _sync_enrollment_to_profile(enrollment):
        portal_user = enrollment.parent_user
        if not portal_user:
            return

        profile = UserProfile.objects.filter(user=portal_user).first()
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

        if enrollment.id_image:
            enrollment_image_name = enrollment.id_image.name
            if not profile.avatar or profile.avatar.name != enrollment_image_name:
                profile.avatar = enrollment_image_name
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

    def _sync_student_user_and_profile(self, enrollment, create_if_missing=False, uploaded_id_image=None):
        student_email = (enrollment.email or "").strip().lower()
        portal_user = enrollment.parent_user

        raw_last = (enrollment.last_name or "").strip().lower()
        raw_first = (enrollment.first_name or "").strip().lower()
        safe_last = slugify(raw_last).replace("-", "")
        safe_first = slugify(raw_first).replace("-", "")
        base_username = "_".join(part for part in [safe_last, safe_first] if part).strip("_") or "student_user"
        username_max_len = User._meta.get_field("username").max_length
        base_username = base_username[:username_max_len]

        def _create_dedicated_portal_user():
            student_num = str(enrollment.student_number).strip() if enrollment.student_number else None

            username = base_username
            i = 1
            while User.objects.filter(username__iexact=username).exists():
                suffix = str(i)
                trimmed_base = base_username[: username_max_len - len(suffix)]
                username = f"{trimmed_base}{suffix}"
                i += 1

            new_user = User.objects.create(
                username=username,
                email=student_email or None,
                role="PARENT_STUDENT",
                status="ACTIVE",
                is_active=True,
            )
            new_user.set_unusable_password()
            new_user.save()
            logger.info(
                "Created dedicated portal user %s (student #%s) for enrollment %s",
                username,
                student_num or "NONE",
                enrollment.pk,
            )
            return new_user

        # STRICT ISOLATION: Check if this enrollment's student number conflicts with an existing account
        # If so, the account belongs to a different student and must not be reused
        if portal_user and create_if_missing and enrollment.student_number:
            existing_profile = UserProfile.objects.filter(user=portal_user).first()
            if existing_profile and existing_profile.student_number:
                linked_student_num = str(existing_profile.student_number).strip()
                current_student_num = str(enrollment.student_number).strip()
                if linked_student_num != current_student_num:
                    logger.warning(
                        "Enrollment %s (student #%s) was linked to user %s (student #%s); isolating to new account to prevent cross-student overwrites.",
                        enrollment.pk,
                        current_student_num,
                        portal_user.pk,
                        linked_student_num,
                    )
                    portal_user = _create_dedicated_portal_user()
                    enrollment.parent_user = portal_user
                    enrollment.save(update_fields=["parent_user"])

        if not portal_user and create_if_missing:
            portal_user = _create_dedicated_portal_user()

            enrollment.parent_user = portal_user
            enrollment.save(update_fields=["parent_user"])

        if not portal_user:
            return

        existing_profile = UserProfile.objects.filter(user=portal_user).first()
        if existing_profile and create_if_missing:
            enrollment_first = slugify((enrollment.first_name or "").strip().lower())
            enrollment_last = slugify((enrollment.last_name or "").strip().lower())
            profile_first = slugify((existing_profile.student_first_name or "").strip().lower())
            profile_last = slugify((existing_profile.student_last_name or "").strip().lower())

            names_mismatch = bool(
                enrollment_first
                and enrollment_last
                and profile_first
                and profile_last
                and (enrollment_first != profile_first or enrollment_last != profile_last)
            )
            # STRICT: Student number is primary identifier - any mismatch means different student
            student_number_mismatch = bool(
                enrollment.student_number
                and existing_profile.student_number
                and str(enrollment.student_number).strip() != str(existing_profile.student_number).strip()
            )
            lrn_mismatch = bool(
                enrollment.lrn
                and existing_profile.lrn
                and str(enrollment.lrn).strip() != str(existing_profile.lrn).strip()
            )

            if names_mismatch or student_number_mismatch or lrn_mismatch:
                logger.warning(
                    "Enrollment %s linked to user %s that appears to belong to another student; creating dedicated user.",
                    enrollment.pk,
                    portal_user.pk,
                )
                portal_user = _create_dedicated_portal_user()
                enrollment.parent_user = portal_user
                enrollment.save(update_fields=["parent_user"])

        grade_code = (enrollment.grade_level or "").strip()
        parent_first_name, parent_last_name = self._get_parent_names_from_enrollment(enrollment)

        if student_email and portal_user.email != student_email:
            portal_user.email = student_email
            portal_user.save(update_fields=["email"])

        profile, created = UserProfile.objects.get_or_create(
            user=portal_user,
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
            # STRICT SAFETY: Never update a profile with mismatched student number
            # This protects against any edge case where wrong student data could overwrite existing profile
            if profile.student_number:
                profile_student_num = str(profile.student_number).strip()
                enrollment_student_num = str(enrollment.student_number).strip() if enrollment.student_number else ""
                
                if enrollment_student_num and profile_student_num != enrollment_student_num:
                    logger.error(
                        "SECURITY: Attempted to update profile with mismatched student numbers. "
                        "Profile has student #%s but enrollment #%s is trying to update it. "
                        "Skipping profile update to prevent data corruption.",
                        profile_student_num,
                        enrollment_student_num,
                    )
                    # Do not update the profile - return early to prevent overwrites
                    return
            
            profile.student_first_name = enrollment.first_name or profile.student_first_name
            profile.student_middle_name = enrollment.middle_name or profile.student_middle_name
            profile.student_last_name = enrollment.last_name or profile.student_last_name
            profile.grade_level = grade_code or profile.grade_level
            profile.lrn = enrollment.lrn or profile.lrn

            if enrollment.student_number:
                profile.student_number = enrollment.student_number

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

        proof_qs = ProofOfPayment.objects.filter(enrollment=enrollment)
        if proof_qs.exists() and proof_qs.exclude(user=portal_user).exists():
            proof_qs.exclude(user=portal_user).update(user=portal_user)

    def _send_student_portal_email(self, enrollment, recipient_email):
        if not enrollment.parent_user:
            return False, "No portal user linked."

        uidb64 = urlsafe_base64_encode(force_bytes(enrollment.parent_user.pk))
        token = default_token_generator.make_token(enrollment.parent_user)

        frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        reset_url = f"{frontend_base}/set-password/{uidb64}/{token}"

        try:
            send_mail(
                subject="Enrollment Application Status - Student Portal Account",
                message=(
                    f"Dear Parent/Guardian,\n\n"
                    f"Congratulations and welcome to Caloocan Evangelical School Inc. (CESI)!\n\n"
                    f"We are pleased to inform you that the enrollment of "
                    f"{enrollment.first_name} {enrollment.last_name} "
                    f"for Academic Year {enrollment.academic_year} has been approved.\n\n"
                    f"A Student Portal account has been prepared for your family with the following details:\n\n"
                    f"Student Name   : {enrollment.first_name} {enrollment.last_name}\n"
                    f"Student Number : {self._get_effective_student_number(enrollment)}\n"
                    f"Username       : {enrollment.parent_user.username}\n\n"
                    f"To activate your account and set your password, please use the link below:\n"
                    f"{reset_url}\n\n"
                    f"Once your password is set, you may log in anytime to view your child's enrollment records and stay updated on school transactions.\n\n"
                    f"If you have any questions or need assistance, please do not hesitate to contact the school.\n\n"
                    f"Thank you for being part of the CESI community.\n\n"
                    f"Sincerely,\n"
                    f"Caloocan Evangelical School Inc.\n"
                    f"Admissions Office"
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
                recipient_list=[recipient_email],
                fail_silently=False,
            )
            return True, None
        except Exception as e:
            logger.exception("Failed to send student portal email for enrollment %s", enrollment.pk)
            return False, str(e)

    def _send_promotion_email(self, enrollment, recipient_email, grade_code):
        grade_labels = {
            "prek": "Pre-Kinder",
            "kinder": "Kinder",
            "grade1": "Grade 1",
            "grade2": "Grade 2",
            "grade3": "Grade 3",
            "grade4": "Grade 4",
            "grade5": "Grade 5",
            "grade6": "Grade 6",
        }
        pretty_grade = grade_labels.get((grade_code or "").lower(), grade_code)

        try:
            send_mail(
                subject="Student Promotion Confirmed",
               message=(
                        f"Dear Parent/Guardian,\n\n"
                        f"Congratulations and warm greetings from Caloocan Evangelical School Inc. (CESI)!\n\n"
                        f"We are delighted to inform you that "
                        f"{enrollment.first_name} {enrollment.last_name} "
                        f"has successfully been promoted and approved for the upcoming academic year.\n\n"
                        f"Please find the updated student information below:\n\n"
                        f"Student Name   : {enrollment.first_name} {enrollment.last_name}\n"
                        f"New Grade Level: {pretty_grade}\n"
                        f"Academic Year  : {enrollment.academic_year}\n"
                        f"Student Number : {self._get_effective_student_number(enrollment)}\n\n"
                        f"You may now log in to the Student Portal to view the updated enrollment record.\n\n"
                        f"We look forward to another year of growth and learning with your child at CESI.\n\n"
                        f"Should you have any questions or need assistance, please do not hesitate to contact the school.\n\n"
                        f"Thank you for your continued trust and support.\n\n"
                        f"Sincerely,\n"
                        f"Caloocan Evangelical School Inc.\n"
                        f"Admissions Office"
                    ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
                recipient_list=[recipient_email],
                fail_silently=False,
            )
            return True, None
        except Exception as e:
            logger.exception("Failed to send promotion email for enrollment %s", enrollment.pk)
            return False, str(e)

    def _send_declined_email(self, enrollment, recipient_email, decline_reason=""):
        grade_labels = {
            "prek": "Pre-Kinder",
            "kinder": "Kinder",
            "grade1": "Grade 1",
            "grade2": "Grade 2",
            "grade3": "Grade 3",
            "grade4": "Grade 4",
            "grade5": "Grade 5",
            "grade6": "Grade 6",
        }
        pretty_grade = grade_labels.get((enrollment.grade_level or "").lower(), enrollment.grade_level)

        reason_block = ""
        if decline_reason:
            reason_block = f"Reason        : {decline_reason}\n\n"

        try:
            send_mail(
                subject="Enrollment Application Status - Caloocan Evangelical School Inc.",
                message=(
                    f"Dear Parent/Guardian,\n\n"
                    f"Thank you for entrusting Caloocan Evangelical School Inc. (CESI) with your child's education.\n\n"
                    f"After careful review of the application submitted for "
                    f"{enrollment.first_name} {enrollment.last_name} "
                    f"for Academic Year {enrollment.academic_year}, we regret to inform you that the enrollment application cannot be accommodated at this time.\n\n"
                    f"Application Details:\n\n"
                    f"Student Name   : {enrollment.first_name} {enrollment.last_name}\n"
                    f"Grade Level    : {pretty_grade}\n"
                    f"Academic Year  : {enrollment.academic_year}\n"
                    f"{reason_block}"
                    f"We understand that this may be disappointing news, and we appreciate your interest in CESI.\n\n"
                    f"Should you have any questions or require further clarification regarding this decision, please feel free to contact the Admissions Office.\n\n"
                    f"We wish your child continued success in their educational journey.\n\n"
                    f"Thank you for your understanding.\n\n"
                    f"Sincerely,\n"
                    f"Caloocan Evangelical School Inc.\n"
                    f"Admissions Office"
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
                recipient_list=[recipient_email],
                fail_silently=False,
            )
            return True, None
        except Exception as e:
            logger.exception("Failed to send declined email for enrollment %s", enrollment.pk)
            return False, str(e)
    def perform_update(self, serializer):
        enrollment = serializer.save()
        uploaded_id_image = self.request.FILES.get("id_image")

        if uploaded_id_image:
            enrollment.id_image = uploaded_id_image
            enrollment.save(update_fields=["id_image", "updated_at"])

        self._save_optional_documents(enrollment, self.request.FILES)

        self._sync_student_user_and_profile(
            enrollment,
            create_if_missing=False,
            uploaded_id_image=uploaded_id_image,
        )
        self._sync_enrollment_to_profile(enrollment)

    # ------------------- Admin File Actions -------------------

    @action(detail=True, methods=["post"], url_path="upload-id-image")
    def upload_id_image(self, request, pk=None):
        enrollment = self.get_object()

        uploaded = request.FILES.get("id_image")
        if not uploaded:
            return Response({"detail": "No ID image uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        enrollment.id_image = uploaded
        enrollment.save(update_fields=["id_image", "updated_at"])

        if enrollment.parent_user:
            profile = UserProfile.objects.filter(user=enrollment.parent_user).first()
            if profile:
                # Reuse the already-saved image path to avoid a second upload
                # of the same in-memory file object to S3.
                profile.avatar = enrollment.id_image.name
                profile.save(update_fields=["avatar"])

        serializer = EnrollmentDetailedSerializer(enrollment, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="id_image", permission_classes=[AllowAny])
    def id_image(self, request, pk=None):
        enrollment = self.get_object()

        try:
            if enrollment.id_image and enrollment.id_image.storage.exists(enrollment.id_image.name):
                return redirect(enrollment.id_image.url)
        except Exception:
            pass

        if getattr(enrollment, "id_image_data", None):
            return HttpResponse(enrollment.id_image_data, content_type=(enrollment.id_image_mime or "image/webp"))

        raise Http404("ID image not available")

    @action(detail=True, methods=["post"], url_path="documents/upload")
    def upload_document(self, request, pk=None):
        enrollment = self.get_object()

        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        document_type = (request.data.get("document_type") or "other").strip()
        label = (request.data.get("label") or uploaded.name).strip()

        allowed_types = {
            "form_137",
            "sf10",
            "birth_certificate",
            "good_moral",
            "report_card",
            "other",
        }
        if document_type not in allowed_types:
            document_type = "other"

        doc = EnrollmentDocument.objects.create(
            enrollment=enrollment,
            document_type=document_type,
            file=uploaded,
            label=label,
        )

        return Response(
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "file": doc.file.url if doc.file else "",
                "label": doc.label,
                "uploaded_at": getattr(doc, "uploaded_at", None),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["patch"], url_path=r"documents/(?P<document_id>[^/.]+)/update")
    def update_document(self, request, pk=None, document_id=None):
        enrollment = self.get_object()

        try:
            doc = EnrollmentDocument.objects.get(pk=document_id, enrollment=enrollment)
        except EnrollmentDocument.DoesNotExist:
            return Response({"detail": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        new_label = request.data.get("label")
        new_type = request.data.get("document_type")
        new_file = request.FILES.get("file")

        allowed_types = {
            "form_137",
            "sf10",
            "birth_certificate",
            "good_moral",
            "report_card",
            "other",
        }

        if new_label is not None:
            doc.label = str(new_label).strip()

        if new_type is not None:
            cleaned_type = str(new_type).strip()
            if cleaned_type in allowed_types:
                doc.document_type = cleaned_type

        if new_file:
            if doc.file:
                doc.file.delete(save=False)
            doc.file = new_file

        doc.save()

        return Response(
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "file": doc.file.url if doc.file else "",
                "label": doc.label,
                "uploaded_at": getattr(doc, "uploaded_at", None),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["delete"], url_path=r"documents/(?P<document_id>[^/.]+)/delete")
    def delete_document(self, request, pk=None, document_id=None):
        enrollment = self.get_object()

        try:
            doc = EnrollmentDocument.objects.get(pk=document_id, enrollment=enrollment)
        except EnrollmentDocument.DoesNotExist:
            return Response({"detail": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        if doc.file:
            doc.file.delete(save=False)
        doc.delete()

        return Response({"detail": "Document deleted successfully."}, status=status.HTTP_200_OK)

    # ------------------- Admin Status Actions -------------------

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

            decline_reason = (
                request.data.get("reason")
                or request.data.get("remarks")
                or ""
            ).strip()

            enrollment.status = "DROPPED"
            enrollment.completed_at = timezone.now()

            note = "DECLINED BY ADMIN"

            base_remarks = (enrollment.remarks or "").strip()
            if "DECLINED BY ADMIN" in base_remarks:
                base_remarks = base_remarks.split("DECLINED BY ADMIN")[0].strip(" |")

            if decline_reason:
                decline_note = f"{note} | REASON: {decline_reason}"
            else:
                decline_note = note

            enrollment.remarks = f"{base_remarks} | {decline_note}".strip(" |")
            enrollment.save()

            if enrollment.parent_user_id:
                profile = UserProfile.objects.filter(user=enrollment.parent_user).first()
                if profile:
                    profile.section = None
                    profile.save(update_fields=["section"])

            email_sent = None
            email_error = None
            
            print("user:", request.user)
            print("is_authenticated:", request.user.is_authenticated)
            print("is_staff:", getattr(request.user, "is_staff", None))
            print("auth:", request.auth)
            recipient_email = (enrollment.email or "").strip().lower()
            if recipient_email:
                email_sent, email_error = self._send_declined_email(
                    enrollment,
                    recipient_email,
                    decline_reason=decline_reason,
                )

            serializer = self.get_serializer(enrollment)
            data = serializer.data
            data["email_sent"] = email_sent
            data["decline_reason"] = decline_reason
            if email_error:
                data["email_error"] = "Enrollment updated, but email sending failed."
            return Response(data)
    
    @action(detail=True, methods=["post"])    
    def mark_active(self, request, pk=None):
        enrollment = self.get_object()

        amount_raw = request.data.get("amount")
        approval_remarks = (request.data.get("remarks") or "").strip()
        payment_method = (request.data.get("payment_method") or "CASH").strip().upper()

        try:
            approved_amount = Decimal(str(amount_raw or "0"))
        except Exception:
            return Response(
                {"detail": "Invalid payment amount."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if approved_amount <= 0:
            return Response(
                {"detail": "Approved payment amount must be greater than 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if (enrollment.student_type or "").strip().lower() == "old" and enrollment.parent_user:
            balance_block = self._ensure_old_student_has_no_balance(enrollment.parent_user)
            if balance_block:
                return balance_block

        grade_code = (enrollment.grade_level or "").strip()
        valid_grades = {
            "prek", "kinder", "grade1", "grade2",
            "grade3", "grade4", "grade5", "grade6",
        }

        if grade_code not in valid_grades:
            return Response(
                {"detail": f"Invalid grade_level on enrollment: {enrollment.grade_level}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tuition = TuitionConfig.objects.filter(
            grade_key=grade_code,
            is_active=True,
            status="active",
        ).first()
        minimum_initial_payment = Decimal(str(tuition.initial or 0)) if tuition else Decimal("0")
        
        # For new students, include assessment fee in minimum payment requirement
        is_new_student = (enrollment.student_type or "").strip().lower() == "new"
        assessment_fee = Decimal(str(tuition.assessment or 0)) if (tuition and is_new_student) else Decimal("0")
        minimum_total_payment = minimum_initial_payment + assessment_fee

        if minimum_total_payment > 0 and approved_amount < minimum_total_payment:
            return Response(
                {
                    "detail": (
                        f"Approved amount (Php {approved_amount:.2f}) is below the required "
                        f"initial payment for {grade_code} (Php {minimum_initial_payment:.2f})"
                        + (f" + assessment fee (Php {assessment_fee:.2f})" if assessment_fee > 0 else "")
                        + f" = Total (Php {minimum_total_payment:.2f})."
                    )
                },
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
        recipient_email = (enrollment.email or "").strip().lower()
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

        email_sent = None
        email_error = None

        with transaction.atomic():
            
            if enrollment.section_id is None:
                section_level = self._grade_code_to_section_level(grade_code)
                if section_level is not None:
                    auto_section = (
                        Section.objects.filter(grade_level=section_level).order_by("id").first()
                    )
                    if auto_section:
                        enrollment.section = auto_section

            if not enrollment.student_number:
                if (enrollment.student_type or "").strip().lower() == "old":
                    enrollment.student_number = None
                else:
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

            update_fields = ["status", "remarks", "updated_at"]
            if enrollment.student_number:
                update_fields.append("student_number")
            if uploaded_id_image:
                update_fields.append("id_image")
            if enrollment.section is not None:
                update_fields.append("section")

            enrollment.save(update_fields=update_fields)

            proof = ProofOfPayment.objects.filter(enrollment=enrollment).order_by("-created_at").first()
            proof_reference = proof.reference_number if proof else ""
            if proof:
                proof.status = "approved"
                proof.amount = approved_amount
                proof.admin_remarks = (
                    approval_remarks or "Approved during enrollment approval."
                )
                proof.save(update_fields=["status", "amount", "admin_remarks", "updated_at"])      
            payment_description = approval_remarks or "Admin-approved enrollment payment"
            if proof_reference:
                payment_description = f"{payment_description} | Proof Ref: {proof_reference}"      

            if recipient_email:
                had_existing_user = bool(enrollment.parent_user_id)

                self._sync_student_user_and_profile(
                    enrollment,
                    create_if_missing=True,
                    uploaded_id_image=uploaded_id_image,
                )
                enrollment.refresh_from_db()

                if enrollment.parent_user:
                    if is_promotion and had_existing_user:
                        email_sent, email_error = self._send_promotion_email(
                            enrollment, recipient_email, grade_code
                        )
                    else:
                        email_sent, email_error = self._send_student_portal_email(
                            enrollment, recipient_email
                        )

            self._sync_enrollment_to_profile(enrollment)

            if enrollment.parent_user:
                self._create_finance_ledger_for_enrollment(enrollment)

                student_name = self._student_full_name(enrollment)
                today = timezone.localdate()
                semester = self._semester_from_date(today)

                self._create_transaction(
                    enrollment=enrollment,
                    parent_user=enrollment.parent_user,
                    student_name=student_name,
                    school_year=enrollment.academic_year,
                    semester=semester,
                    transaction_type="TUITION",
                    entry_type="CREDIT",
                    item="PAYMENT",
                    amount=approved_amount,
                    description=payment_description,
                    payment_method=payment_method,
                    transaction_date=today,
                    due_date=None,
                    status_value="PAID",
                    reference_number=proof_reference,
                )

                self._recompute_parent_ledger_balances(enrollment.parent_user)

        serializer = self.get_serializer(enrollment)
        data = serializer.data
        data["email_sent"] = email_sent
        if email_error:
            data["email_error"] = "Enrollment approved, but email sending failed."
        return Response(data)

    # ------------------- Query Actions -------------------

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

        return Response(
            {
                "total_enrollments": total_enrollments,
                "active_enrollments": active_enrollments,
                "completed_enrollments": completed_enrollments,
                "dropped_enrollments": dropped_enrollments,
                "pending_enrollments": pending_enrollments,
                "by_grade": by_grade,
            }
        )