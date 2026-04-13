from decimal import Decimal

from django.core.management.base import BaseCommand

from finance.models import ProofOfPayment, Transaction


class Command(BaseCommand):
    help = (
        "Backfill approved enrollment proof amounts that are still 0.00 "
        "using related credit payment transactions."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without saving changes.",
        )
        parser.add_argument(
            "--proof-id",
            type=int,
            default=None,
            help="Limit update to a single ProofOfPayment id.",
        )

    def _resolve_amount(self, proof):
        if proof.approved_transaction and Decimal(str(proof.approved_transaction.amount or 0)) > 0:
            return Decimal(str(proof.approved_transaction.amount)), "approved_transaction"

        if not proof.enrollment_id:
            return None, "no_enrollment"

        tx_base = Transaction.objects.filter(
            enrollment_id=proof.enrollment_id,
            entry_type="CREDIT",
            item="PAYMENT",
            amount__gt=0,
        )

        if proof.reference_number:
            tx_by_ref = tx_base.filter(reference_number=proof.reference_number).order_by("-date_created", "-id").first()
            if tx_by_ref:
                return Decimal(str(tx_by_ref.amount)), "reference_match"

        tx_latest = tx_base.order_by("-date_created", "-id").first()
        if tx_latest:
            return Decimal(str(tx_latest.amount)), "latest_credit_payment"

        return None, "no_payment_transaction"

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        proof_id = options.get("proof_id")

        queryset = ProofOfPayment.objects.select_related("approved_transaction", "enrollment").filter(
            payment_type="enrollment",
            status="approved",
            amount__lte=0,
        )

        if proof_id:
            queryset = queryset.filter(id=proof_id)

        total = queryset.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("No matching proofs found for backfill."))
            return

        self.stdout.write(f"Found {total} approved enrollment proofs with amount <= 0.")

        updated = 0
        skipped = 0

        for proof in queryset:
            amount, source = self._resolve_amount(proof)

            if amount is None or amount <= 0:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"- Skipped proof #{proof.id}: could not resolve amount ({source})."
                    )
                )
                continue

            if dry_run:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"- Would update proof #{proof.id}: 0.00 -> {amount} ({source})."
                    )
                )
            else:
                proof.amount = amount
                proof.save(update_fields=["amount", "updated_at"])
                self.stdout.write(
                    self.style.SUCCESS(
                        f"- Updated proof #{proof.id}: amount set to {amount} ({source})."
                    )
                )

            updated += 1

        mode_label = "Dry run" if dry_run else "Backfill"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode_label} complete. Updated: {updated}, Skipped: {skipped}, Total scanned: {total}."
            )
        )
