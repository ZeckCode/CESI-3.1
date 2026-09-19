from decimal import Decimal

from django.core.management.base import BaseCommand

from accounts.models import User
from enrollment.models import Enrollment
from finance.models import Transaction
from finance.utils import (
    recompute_running_balances_for_enrollment,
    recompute_transaction_statuses_for_enrollment,
)


class Command(BaseCommand):
    help = (
        "Repair ledger balances and statuses for tuition transactions by enrollment. "
        "Runs recompute_running_balances_for_enrollment and "
        "recompute_transaction_statuses_for_enrollment."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--all-status",
            action="store_true",
            help="Include non-ACTIVE enrollments.",
        )
        parser.add_argument(
            "--enrollment-id",
            type=int,
            default=None,
            help="Target one enrollment id.",
        )
        parser.add_argument(
            "--student-number",
            type=str,
            default=None,
            help="Target latest enrollment for this student number.",
        )
        parser.add_argument(
            "--username",
            type=str,
            default=None,
            help="Target latest enrollment for this parent/student username.",
        )

    def _status_counts(self, enrollment):
        counts = {
            "PAID": 0,
            "PARTIAL": 0,
            "PENDING": 0,
            "OVERDUE": 0,
            "POSTED": 0,
        }

        rows = Transaction.objects.filter(enrollment=enrollment)
        for row in rows:
            status_key = str(row.status or "").upper()
            if status_key in counts:
                counts[status_key] += 1

        return counts

    def handle(self, *args, **options):
        all_status = options["all_status"]
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

        enrollments = Enrollment.objects.filter(parent_user__isnull=False).order_by("id")

        if enrollment_id:
            enrollments = enrollments.filter(id=enrollment_id)
        elif student_number:
            base = enrollments if all_status else enrollments.filter(status="ACTIVE")
            enrollments = base.filter(student_number=student_number).order_by("-created_at", "-id")[:1]
        elif username:
            user = User.objects.filter(username=username).first()
            if not user:
                self.stdout.write(self.style.ERROR(f"No user found with username '{username}'."))
                return
            base = enrollments if all_status else enrollments.filter(status="ACTIVE")
            enrollments = base.filter(parent_user=user).order_by("-created_at", "-id")[:1]
        elif not all_status:
            enrollments = enrollments.filter(status="ACTIVE")

        scanned = 0
        repaired = 0
        unchanged = 0

        for enrollment in enrollments:
            scanned += 1

            # Keep aggregate math aligned with ledger running balance behavior.
            running_before = Decimal("0.00")
            before_rows = Transaction.objects.filter(enrollment=enrollment).order_by(
                "transaction_date", "date_posted", "id"
            )
            for row in before_rows:
                running_before += Decimal(str(row.debit or 0)) - Decimal(str(row.credit or 0))

            before_counts = self._status_counts(enrollment)

            running_after = recompute_running_balances_for_enrollment(enrollment)
            recompute_transaction_statuses_for_enrollment(enrollment)

            after_counts = self._status_counts(enrollment)
            changed = (before_counts != after_counts) or (running_before != running_after)

            if changed:
                repaired += 1
            else:
                unchanged += 1

            self.stdout.write(
                f"- Enrollment #{enrollment.id} ({enrollment.student_number or 'N/A'}): "
                f"before_balance={running_before}, after_balance={running_after}, changed={changed}"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Repair complete. Scanned={scanned}, Repaired={repaired}, Unchanged={unchanged}."
            )
        )
