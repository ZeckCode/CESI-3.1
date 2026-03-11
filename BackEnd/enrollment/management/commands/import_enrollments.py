import json
from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import User
from enrollment.models import Enrollment, ParentInfo


class Command(BaseCommand):
    help = "Bulk import enrollments from a JSON file"

    def add_arguments(self, parser):
        parser.add_argument(
            "file",
            type=str,
            help='Path to JSON file with enrollment data (e.g., "enrollments.json")',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        file_path = options["file"]

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            self.stdout.write(
                self.style.ERROR(f"File not found: {file_path}")
            )
            return
        except json.JSONDecodeError:
            self.stdout.write(
                self.style.ERROR(f"Invalid JSON in file: {file_path}")
            )
            return

        if not isinstance(data, list):
            self.stdout.write(
                self.style.ERROR("JSON must be a list of enrollment objects")
            )
            return

        created_count = 0
        skipped_count = 0
        error_count = 0

        for idx, enrollment_data in enumerate(data, 1):
            try:
                parent_info_data = enrollment_data.pop("parent_info", {})
                website = enrollment_data.pop("website", "")

                # Skip honeypot check
                if website:
                    self.stdout.write(
                        self.style.WARNING(f"Skipping entry {idx}: Honeypot detected")
                    )
                    skipped_count += 1
                    continue

                # Get or create student user (public_user)
                student_email = enrollment_data.get("email") or f"student_{idx}@school.local"
                first_name = enrollment_data.get("first_name", "")
                last_name = enrollment_data.get("last_name", "")
                
                student, created = User.objects.get_or_create(
                    email=student_email,
                    defaults={
                        "username": f"student_{last_name}_{idx}".lower().replace(" ", "_"),
                    },
                )

                enrollment_data["student"] = student

                # Create enrollment
                enrollment = Enrollment.objects.create(**enrollment_data)

                # Create parent info if provided
                if parent_info_data:
                    ParentInfo.objects.create(
                        enrollment=enrollment, **parent_info_data
                    )

                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ Entry {idx}: {enrollment_data.get('first_name')} "
                        f"{enrollment_data.get('last_name')} ({enrollment_data.get('grade_level')})"
                    )
                )

            except KeyError as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f"Entry {idx}: Missing required field {e}")
                )
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f"Entry {idx}: {str(e)}")
                )

        self.stdout.write(
            self.style.SUCCESS(f"\n{'='*50}")
        )
        self.stdout.write(
            self.style.SUCCESS(f"Completed: {created_count} created, "
                              f"{skipped_count} skipped, {error_count} errors")
        )
