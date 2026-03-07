"""
Django management command to export database to JSON without BOM.
This creates a portable backup that can be included in version control.
"""
import json
from django.core.management.base import BaseCommand
from django.core.serializers import serialize
from django.apps import apps


class Command(BaseCommand):
    help = "Export database to JSON file without BOM for version control"

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            default='db_backup.json',
            help='Output file path (default: db_backup.json)'
        )
        parser.add_argument(
            '--indent',
            type=int,
            default=2,
            help='JSON indentation (default: 2)'
        )

    def handle(self, *args, **options):
        output_file = options['output']
        indent = options['indent']

        # Models to export in dependency order
        models_to_export = [
            # Core user models
            'accounts.User',
            'accounts.AdminProfile',
            'accounts.UserProfile',
            'accounts.TeacherProfile',
            'accounts.Subject',
            'accounts.Section',
            # Class management
            'classmanagement.Room',
            'classmanagement.SchoolYear',
            'classmanagement.Schedule',
            # Announcements
            'announcements.Announcement',
            'announcements.AnnouncementMedia',
            # Enrollment
            'enrollment.Enrollment',
            # Attendance
            'attendance.Attendance',
            # Grades
            'grades.Grade',
            # Finance
            'finance.Payment',
            'finance.PaymentRecord',
        ]

        all_data = []
        
        for model_name in models_to_export:
            try:
                app_label, model = model_name.split('.')
                Model = apps.get_model(app_label, model)
                queryset = Model.objects.all()
                
                if queryset.exists():
                    data = json.loads(serialize('json', queryset))
                    all_data.extend(data)
                    self.stdout.write(f"  Exported {queryset.count()} {model_name} records")
                else:
                    self.stdout.write(f"  Skipped {model_name} (no records)")
            except LookupError:
                self.stdout.write(self.style.WARNING(f"  Model not found: {model_name}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Error exporting {model_name}: {e}"))

        # Write to file without BOM, using utf-8 encoding
        with open(output_file, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(all_data, f, indent=indent, ensure_ascii=False)

        self.stdout.write(
            self.style.SUCCESS(f"\nExported {len(all_data)} total records to {output_file}")
        )
