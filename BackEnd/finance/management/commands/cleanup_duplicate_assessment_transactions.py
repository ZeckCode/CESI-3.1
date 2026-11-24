from django.core.management.base import BaseCommand
from django.db.models import Count
from django.db import transaction as db_transaction

from finance.models import Transaction
from finance.utils import (
    recompute_running_balances_for_enrollment,
    recompute_transaction_statuses_for_enrollment,
)


class Command(BaseCommand):
    help = (
        "Detect and clean duplicate TUITION/DEBIT/ASSESSMENT transactions per enrollment. "
        "Dry-run by default. Use --apply to delete duplicates."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply deletion of duplicate assessment transactions.",
        )
        parser.add_argument(
            "--enrollment-id",
            type=int,
            default=None,
            help="Limit cleanup to a single enrollment id.",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        enrollment_id = options.get("enrollment_id")

        base_qs = Transaction.objects.filter(
            transaction_type="TUITION",
            entry_type="DEBIT",
            item="ASSESSMENT",
            enrollment_id__isnull=False,
        )

        if enrollment_id:
            base_qs = base_qs.filter(enrollment_id=enrollment_id)

        duplicated_enrollments = (
            base_qs.values("enrollment_id")
            .annotate(total=Count("id"))
            .filter(total__gt=1)
            .order_by("enrollment_id")
        )

        if not duplicated_enrollments:
            self.stdout.write(self.style.WARNING("No duplicate assessment transactions found."))
            return

        scanned = 0
        duplicate_rows = 0
        deleted_rows = 0
        affected_enrollments = []

        self.stdout.write(
            f"Found {len(duplicated_enrollments)} enrollment(s) with duplicate assessment entries."
        )

        for row in duplicated_enrollments:
            eid = row["enrollment_id"]
            txs = list(
                base_qs.filter(enrollment_id=eid).order_by(
                    "transaction_date", "date_posted", "id"
                )
            )
            if len(txs) <= 1:
                continue

            keep_tx = txs[0]
            drop_txs = txs[1:]
            drop_ids = [tx.id for tx in drop_txs]

            scanned += len(txs)
            duplicate_rows += len(drop_txs)

            self.stdout.write(
                f"- Enrollment #{eid}: keep tx #{keep_tx.id}, remove duplicates {drop_ids}"
            )

            if apply_changes:
                with db_transaction.atomic():
                    Transaction.objects.filter(id__in=drop_ids).delete()
                    recompute_running_balances_for_enrollment(keep_tx.enrollment)
                    recompute_transaction_statuses_for_enrollment(keep_tx.enrollment)

                deleted_rows += len(drop_txs)
                affected_enrollments.append(eid)

        if apply_changes:
            self.stdout.write(
                self.style.SUCCESS(
                    "Cleanup complete. "
                    f"Scanned rows: {scanned}, duplicate rows removed: {deleted_rows}, "
                    f"affected enrollments: {len(affected_enrollments)}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "Dry run complete. "
                    f"Scanned rows: {scanned}, duplicate rows that would be removed: {duplicate_rows}. "
                    "Run again with --apply to commit changes."
                )
            )
