from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction

from accounts.models import User
from enrollment.models import Enrollment
from finance.models import Transaction, TuitionConfig
from finance.utils import (
    recompute_running_balances_for_enrollment,
    recompute_transaction_statuses_for_enrollment,
)


CENT = Decimal("0.01")


def to_money(value):
    return Decimal(str(value or 0)).quantize(CENT)


class Command(BaseCommand):
    help = (
        "Repair installment monthly debit totals so INITIAL + MONTHLY equals tuition.installment. "
        "Dry-run by default; use --apply to persist changes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply updates to monthly installment debits.",
        )
        parser.add_argument(
            "--enrollment-id",
            type=int,
            default=None,
            help="Limit repair to one enrollment id.",
        )
        parser.add_argument(
            "--student-number",
            type=str,
            default=None,
            help="Limit repair to the latest enrollment for this student number.",
        )
        parser.add_argument(
            "--username",
            type=str,
            default=None,
            help="Limit repair to the latest enrollment linked to this parent/student username.",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        enrollment_id = options.get("enrollment_id")
        student_number = str(options.get("student_number") or "").strip()
        username = str(options.get("username") or "").strip()

        if sum(bool(x) for x in [enrollment_id, student_number, username]) > 1:
            self.stdout.write(
                self.style.ERROR(
                    "Use only one targeting flag at a time: --enrollment-id, --student-number, or --username."
                )
            )
            return

        enrollments = Enrollment.objects.filter(
            payment_mode="installment",
            parent_user__isnull=False,
        ).order_by("id")

        if enrollment_id:
            enrollments = enrollments.filter(id=enrollment_id)
        elif student_number:
            enrollments = enrollments.filter(student_number=student_number).order_by("-created_at", "-id")[:1]
        elif username:
            user = User.objects.filter(username=username).first()
            if not user:
                self.stdout.write(self.style.ERROR(f"No user found with username '{username}'."))
                return
            enrollments = enrollments.filter(parent_user=user).order_by("-created_at", "-id")[:1]

        scanned = 0
        candidates = 0
        updated = 0
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

            debit_qs = Transaction.objects.filter(
                enrollment=enrollment,
                parent=enrollment.parent_user,
                transaction_type="TUITION",
                entry_type="DEBIT",
            )

            initial_total = sum(
                (to_money(tx.debit) for tx in debit_qs.filter(item="INITIAL")),
                Decimal("0.00"),
            )
            monthly_rows = list(
                debit_qs.filter(item="MONTHLY").order_by("due_date", "transaction_date", "id")
            )
            monthly_total = sum((to_money(tx.debit) for tx in monthly_rows), Decimal("0.00"))

            if not monthly_rows:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"- Enrollment #{enrollment.id}: skipped (no MONTHLY debit rows found)."
                    )
                )
                continue

            target_installment = to_money(tuition.installment)
            target_monthly_total = to_money(target_installment - initial_total)
            if target_monthly_total < 0:
                target_monthly_total = Decimal("0.00")

            delta = to_money(target_monthly_total - monthly_total)
            if delta == 0:
                skipped += 1
                continue

            last_monthly = monthly_rows[-1]
            new_amount = to_money(to_money(last_monthly.amount) + delta)
            if new_amount < 0:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"- Enrollment #{enrollment.id}: skipped (adjustment would make last MONTHLY negative)."
                    )
                )
                continue

            candidates += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f"- Enrollment #{enrollment.id}: MONTHLY total {monthly_total} -> {target_monthly_total} "
                    f"(delta {delta}, update tx #{last_monthly.id} to {new_amount})."
                )
            )

            if apply_changes:
                with db_transaction.atomic():
                    last_monthly.amount = new_amount
                    last_monthly.save(update_fields=["amount"])
                    recompute_running_balances_for_enrollment(enrollment)
                    recompute_transaction_statuses_for_enrollment(enrollment)
                updated += 1

        mode = "Repair" if apply_changes else "Dry run"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode} complete. Scanned={scanned}, Candidates={candidates}, Updated={updated}, Skipped={skipped}."
            )
        )
