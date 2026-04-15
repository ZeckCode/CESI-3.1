from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction
from django.utils import timezone

from accounts.models import User
from enrollment.models import Enrollment
from finance.models import Transaction, TuitionConfig
from finance.utils import (
    recompute_running_balances_for_enrollment,
    recompute_transaction_statuses_for_enrollment,
)


BILLING_DEBIT_ITEMS = {
    "REGISTRATION",
    "INITIAL",
    "MONTHLY",
    "MISC",
    "RESERVATION",
    "ASSESSMENT",
}


def to_money(value):
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def generate_transaction_reference():
    year = timezone.now().year
    last = Transaction.objects.order_by("-id").first()
    seq = (last.id + 1) if last else 1
    return f"CESI-{year}-{seq:05d}"


def semester_from_date(dt):
    return "1st" if dt.month in [6, 7, 8, 9, 10] else "2nd"


def student_name_for(enrollment):
    full = " ".join(
        p for p in [
            enrollment.first_name or "",
            enrollment.middle_name or "",
            enrollment.last_name or "",
        ] if p
    ).strip()
    if full:
        return full
    return enrollment.student.username


def build_installment_schedule(tuition, *, include_assessment=False):
    items = []
    today = timezone.localdate()
    current_year = timezone.now().year

    initial = to_money(tuition.initial)
    monthly = to_money(tuition.monthly)
    installment = to_money(tuition.installment)
    misc_aug = to_money(tuition.misc_aug)
    misc_nov = to_money(tuition.misc_nov)

    initial_due = date(current_year, 5, 31)
    if initial > 0:
        items.append({
            "item": "INITIAL",
            "description": "Initial Tuition Billing",
            "amount": initial,
            "transaction_date": today,
            "due_date": initial_due,
            "semester": semester_from_date(initial_due),
            "status": "POSTED",
        })

    assessment = to_money(tuition.assessment) if include_assessment else Decimal("0.00")
    if assessment > 0:
        items.append({
            "item": "ASSESSMENT",
            "description": "Assessment Fee Billing",
            "amount": assessment,
            "transaction_date": today,
            "due_date": initial_due,
            "semester": semester_from_date(initial_due),
            "status": "PENDING",
        })

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
                "transaction_date": today,
                "due_date": due,
                "semester": semester_from_date(due),
                "status": "PENDING",
            })

    if misc_aug > 0:
        due = date(current_year, 8, 31)
        items.append({
            "item": "MISC",
            "description": "Miscellaneous (August)",
            "amount": misc_aug,
            "transaction_date": today,
            "due_date": due,
            "semester": semester_from_date(due),
            "status": "PENDING",
        })

    if misc_nov > 0:
        due = date(current_year, 11, 30)
        items.append({
            "item": "MISC",
            "description": "Miscellaneous (November)",
            "amount": misc_nov,
            "transaction_date": today,
            "due_date": due,
            "semester": semester_from_date(due),
            "status": "PENDING",
        })

    return items


def build_cash_schedule(tuition, *, is_new_student=False):
    items = []
    today = timezone.localdate()
    current_year = timezone.now().year

    cash = to_money(tuition.cash)
    reservation_fee = to_money(tuition.reservation_fee)
    assessment = to_money(tuition.assessment) if is_new_student else Decimal("0.00")
    misc_aug = to_money(tuition.misc_aug)
    misc_nov = to_money(tuition.misc_nov)
    total_cash = to_money(tuition.total_cash)

    tuition_only = total_cash - reservation_fee - misc_aug - misc_nov
    if tuition_only < 0:
        tuition_only = cash if cash > 0 else Decimal("0.00")

    if reservation_fee > 0:
        items.append({
            "item": "RESERVATION",
            "description": "Reservation Fee Billing",
            "amount": reservation_fee,
            "transaction_date": today,
            "due_date": None,
            "semester": semester_from_date(today),
            "status": "POSTED",
        })

    if assessment > 0:
        items.append({
            "item": "ASSESSMENT",
            "description": "Assessment Fee Billing",
            "amount": assessment,
            "transaction_date": today,
            "due_date": None,
            "semester": semester_from_date(today),
            "status": "POSTED",
        })

    if tuition_only > 0:
        items.append({
            "item": "REGISTRATION",
            "description": "Cash Tuition Billing",
            "amount": tuition_only,
            "transaction_date": today,
            "due_date": None,
            "semester": semester_from_date(today),
            "status": "POSTED",
        })

    if misc_aug > 0:
        due = date(current_year, 8, 31)
        items.append({
            "item": "MISC",
            "description": "Miscellaneous (August)",
            "amount": misc_aug,
            "transaction_date": today,
            "due_date": due,
            "semester": semester_from_date(due),
            "status": "POSTED",
        })

    if misc_nov > 0:
        due = date(current_year, 11, 30)
        items.append({
            "item": "MISC",
            "description": "Miscellaneous (November)",
            "amount": misc_nov,
            "transaction_date": today,
            "due_date": due,
            "semester": semester_from_date(due),
            "status": "POSTED",
        })

    return items


class Command(BaseCommand):
    help = (
        "Rebuild TUITION billing debits from each enrollment's grade/payment mode while preserving all existing credits. "
        "Dry-run by default; use --apply to save changes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply the debit rebuild. Without this flag, command runs in preview mode.",
        )
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

    def _create_debit_row(self, *, enrollment, schedule_row):
        return Transaction.objects.create(
            parent=enrollment.parent_user,
            enrollment=enrollment,
            student_name=student_name_for(enrollment),
            student_number_snapshot=enrollment.student_number or "",
            grade_level_snapshot=enrollment.grade_level or "",
            payment_mode_snapshot=enrollment.payment_mode or "",
            student_type_snapshot=enrollment.student_type or "",
            school_year=enrollment.academic_year or "",
            semester=schedule_row["semester"],
            transaction_type="TUITION",
            entry_type="DEBIT",
            item=schedule_row["item"],
            amount=to_money(schedule_row["amount"]),
            description=schedule_row["description"],
            payment_method="CASH",
            reference_number=generate_transaction_reference(),
            transaction_date=schedule_row["transaction_date"],
            due_date=schedule_row["due_date"],
            status=schedule_row["status"],
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]
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
        if not all_status:
            enrollments = enrollments.filter(status="ACTIVE")

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
        rebuilt = 0
        skipped = 0

        for enrollment in enrollments:
            scanned += 1

            grade_key = str(enrollment.grade_level or "").strip().lower()
            payment_mode = str(enrollment.payment_mode or "").strip().lower()
            is_new_student = str(enrollment.student_type or "").strip().lower() == "new"

            if payment_mode not in {"cash", "installment"}:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"- Enrollment #{enrollment.id}: skipped (unsupported payment_mode '{payment_mode}')."
                    )
                )
                continue

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

            billing_debits = debit_qs.filter(item__in=BILLING_DEBIT_ITEMS)
            existing_count = billing_debits.count()
            existing_total = sum((to_money(tx.debit) for tx in billing_debits), Decimal("0.00"))

            if payment_mode == "cash":
                schedule = build_cash_schedule(tuition, is_new_student=is_new_student)
            else:
                schedule = build_installment_schedule(tuition, include_assessment=is_new_student)

            new_total = sum((to_money(row["amount"]) for row in schedule), Decimal("0.00"))

            candidates += 1
            self.stdout.write(
                f"- Enrollment #{enrollment.id}: billing debits {existing_count} rows / {existing_total} -> "
                f"{len(schedule)} rows / {new_total}."
            )

            if not apply_changes:
                continue

            with db_transaction.atomic():
                billing_debits.delete()
                for row in schedule:
                    self._create_debit_row(enrollment=enrollment, schedule_row=row)
                recompute_running_balances_for_enrollment(enrollment)
                recompute_transaction_statuses_for_enrollment(enrollment)

            rebuilt += 1

        mode = "Rebuild" if apply_changes else "Dry run"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode} complete. Scanned={scanned}, Candidates={candidates}, Rebuilt={rebuilt}, Skipped={skipped}."
            )
        )
