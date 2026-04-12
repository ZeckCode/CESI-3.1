from django.core.management.base import BaseCommand

from reminders.views import send_upcoming_payment_due_reminders


class Command(BaseCommand):
    help = "Send automatic payment reminder emails for bills due in N days."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days-before",
            type=int,
            default=7,
            help="Send reminders for transactions due in this many days.",
        )

    def handle(self, *args, **options):
        days_before = options["days_before"]
        result = send_upcoming_payment_due_reminders(days_before=days_before)

        self.stdout.write(
            self.style.SUCCESS(
                "Sent upcoming payment reminders for due date {date}: {created} created, {emailed} emailed, "
                "{duplicates} duplicates skipped, {missing} missing email, {failed} email failed, {skipped} skipped."
                .format(
                    date=result["target_date"],
                    created=result["created_count"],
                    emailed=result["emailed_count"],
                    duplicates=result["duplicate_count"],
                    missing=result["missing_email_count"],
                    failed=result["email_failed_count"],
                    skipped=result["skipped_count"],
                )
            )
        )
