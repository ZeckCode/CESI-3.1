"""
Django management command to import database from JSON backup.
"""
import json
from django.core.management.base import BaseCommand
from django.core.serializers import deserialize
from django.db import transaction


class Command(BaseCommand):
    help = "Import database from JSON backup file"

    def add_arguments(self, parser):
        parser.add_argument(
            '--input',
            default='db_backup.json',
            help='Input JSON file path (default: db_backup.json)'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before import (use with caution!)'
        )

    def handle(self, *args, **options):
        input_file = options['input']
        
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            self.stdout.write(self.style.WARNING(f"Backup file not found: {input_file}"))
            self.stdout.write("Skipping import - database will use existing data or be empty.")
            return
        except json.JSONDecodeError as e:
            self.stdout.write(self.style.ERROR(f"Invalid JSON in {input_file}: {e}"))
            return

        if not data:
            self.stdout.write(self.style.WARNING("Backup file is empty, skipping import."))
            return

        self.stdout.write(f"Found {len(data)} records in {input_file}")

        imported = 0
        skipped = 0
        errors = 0

        # Convert back to JSON string for deserializer
        json_str = json.dumps(data)

        try:
            with transaction.atomic():
                for obj in deserialize('json', json_str):
                    try:
                        # Check if object already exists
                        Model = obj.object.__class__
                        pk = obj.object.pk
                        
                        if Model.objects.filter(pk=pk).exists():
                            skipped += 1
                        else:
                            obj.save()
                            imported += 1
                    except Exception as e:
                        errors += 1
                        self.stdout.write(self.style.WARNING(f"  Error importing {obj.object}: {e}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Import failed: {e}"))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"\nImport complete: {imported} imported, {skipped} skipped (already exist), {errors} errors"
            )
        )
