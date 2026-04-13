from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction
from django.db.models import Sum

from enrollment.models import Enrollment
from finance.models import Transaction, TuitionConfig
from finance.utils import (
    recompute_running_balances_for_enrollment,
    recompute_transaction_statuses_for_enrollment,
)


class Command(BaseCommand):
    help = (
        "Repair underbilled NEW+CASH enrollments where assessment row exists but "
        "registration was reduced by assessment, causing total_debit to miss assessment. "
        "Dry-run by default; use --apply to save changes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply the repair updates.",
        )
        parser.add_argument(
            "--enrollment-id",
            type=int,
            default=None,
            help="Limit repair to one enrollment id.",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        enrollment_id = options.get("enrollment_id")

        enrollments = Enrollment.objects.filter(
            status="ACTIVE",
            student_type="new",
            payment_mode="cash",
        ).order_by("id")

        if enrollment_id:
            enrollments = enrollments.filter(id=enrollment_id)

        scanned = 0
        repaired = 0
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
            total_cash = Decimal(str(tuition.total_cash or 0))
            expected_total = total_cash + assessment

            debit_qs = Transaction.objects.filter(
                enrollment=enrollment,
                transaction_type="TUITION",
                entry_type="DEBIT",
            )

            total_debit = Decimal(str(debit_qs.aggregate(total=Sum("debit")).get("total") or 0))
            assessment_exists = debit_qs.filter(item="ASSESSMENT").exists()
            registration_tx = debit_qs.filter(item="REGISTRATION").order_by("id").first()

            if assessment <= 0 or not assessment_exists or not registration_tx:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"- Enrollment #{enrollment.id}: skipped (assessment/registration prerequisites not met)."
                    )
                )
                continue

            if total_debit == expected_total:
                skipped += 1
                self.stdout.write(
                    f"- Enrollment #{enrollment.id}: already correct (total_debit={total_debit})."
                )
                continue

            # Repair only the known underbilled case: total equals total_cash (missing +assessment).
            if total_debit != total_cash:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"- Enrollment #{enrollment.id}: skipped (unexpected total_debit={total_debit}, expected either {total_cash} or {expected_total})."
                    )
                )
                continue

            new_registration_amount = Decimal(str(registration_tx.amount or 0)) + assessment

            self.stdout.write(
                self.style.SUCCESS(
                    f"- Enrollment #{enrollment.id}: REGISTRATION tx #{registration_tx.id} amount {registration_tx.amount} -> {new_registration_amount}"
                )
            )

            if apply_changes:
                with db_transaction.atomic():
                    registration_tx.amount = new_registration_amount
                    registration_tx.save()
                    recompute_running_balances_for_enrollment(enrollment)
                    recompute_transaction_statuses_for_enrollment(enrollment)
                repaired += 1

        mode = "Repair" if apply_changes else "Dry run"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode} complete. Scanned={scanned}, Repaired={repaired}, Skipped={skipped}."
            )
        )
