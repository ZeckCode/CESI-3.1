from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction
from django.utils import timezone

from enrollment.models import Enrollment
from finance.models import Transaction, TuitionConfig
from finance.utils import (
    recompute_running_balances_for_enrollment,
    recompute_transaction_statuses_for_enrollment,
)


class Command(BaseCommand):
    help = (
        "Backfill missing TUITION/DEBIT/ASSESSMENT transactions for NEW students. "
        "Dry-run by default; use --apply to create missing entries."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply creation of missing assessment transactions.",
        )
        parser.add_argument(
            "--enrollment-id",
            type=int,
            default=None,
            help="Limit backfill to one enrollment id.",
        )

    @staticmethod
    def _semester_from_date(dt):
        return "1st" if dt.month in [6, 7, 8, 9, 10] else "2nd"

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        enrollment_id = options.get("enrollment_id")

        enrollments = Enrollment.objects.filter(
            student_type="new",
            parent_user__isnull=False,
        ).order_by("id")

        if enrollment_id:
            enrollments = enrollments.filter(id=enrollment_id)

        scanned = 0
        candidates = 0
        created = 0
        skipped = 0

        for enrollment in enrollments:
            scanned += 1

            grade_key = str(enrollment.grade_level or "").strip().lower()
            tuition = TuitionConfig.objects.filter(
                grade_key=grade_key,
                is_active=True,
                status="active",
            ).first()

            if not tuition:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"- Enrollment #{enrollment.id}: skipped (no active tuition config for {grade_key})."
                    )
                )
                continue

            assessment = Decimal(str(tuition.assessment or 0))
            if assessment <= 0:
                skipped += 1
                self.stdout.write(
                    f"- Enrollment #{enrollment.id}: skipped (assessment is zero)."
                )
                continue

            debit_qs = Transaction.objects.filter(
                enrollment=enrollment,
                parent=enrollment.parent_user,
                transaction_type="TUITION",
                entry_type="DEBIT",
            )

            if debit_qs.filter(item="ASSESSMENT").exists():
                skipped += 1
                self.stdout.write(
                    f"- Enrollment #{enrollment.id}: already has assessment debit."
                )
                continue

            first_tx = debit_qs.order_by("transaction_date", "date_posted", "id").first()
            tx_date = (first_tx.transaction_date if first_tx and first_tx.transaction_date else timezone.localdate())

            payment_mode = str(enrollment.payment_mode or "").strip().lower()
            due_date = None
            status_value = "POSTED"
            semester = self._semester_from_date(tx_date)

            if payment_mode == "installment":
                due_date = date(tx_date.year, 5, 31)
                status_value = "PENDING"
                semester = self._semester_from_date(due_date)

            student_name = " ".join(
                p
                for p in [
                    enrollment.first_name or "",
                    enrollment.middle_name or "",
                    enrollment.last_name or "",
                ]
                if p
            ).strip() or enrollment.student.username

            candidates += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f"- Enrollment #{enrollment.id}: missing ASSESSMENT debit -> {assessment}"
                )
            )

            if apply_changes:
                with db_transaction.atomic():
                    Transaction.objects.create(
                        parent=enrollment.parent_user,
                        enrollment=enrollment,
                        student_name=student_name,
                        student_number_snapshot=enrollment.student_number or "",
                        grade_level_snapshot=enrollment.grade_level or "",
                        payment_mode_snapshot=enrollment.payment_mode or "",
                        student_type_snapshot=enrollment.student_type or "",
                        school_year=enrollment.academic_year or "",
                        semester=semester,
                        transaction_type="TUITION",
                        entry_type="DEBIT",
                        item="ASSESSMENT",
                        amount=assessment,
                        description="Assessment Fee Billing (backfill)",
                        payment_method=(first_tx.payment_method if first_tx and first_tx.payment_method else "CASH"),
                        reference_number=None,
                        transaction_date=tx_date,
                        due_date=due_date,
                        status=status_value,
                    )
                    recompute_running_balances_for_enrollment(enrollment)
                    recompute_transaction_statuses_for_enrollment(enrollment)

                created += 1

        mode = "Backfill" if apply_changes else "Dry run"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode} complete. Scanned={scanned}, Candidates={candidates}, Created={created}, Skipped={skipped}."
            )
        )
