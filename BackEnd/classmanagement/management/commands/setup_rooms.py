"""
Django management command to set up default school rooms.
"""
from django.core.management.base import BaseCommand
from classmanagement.models import Room


DEFAULT_ROOMS = [
    {"code": "1F-A", "name": "First Floor Room A", "capacity": 40},
    {"code": "1F-B", "name": "First Floor Room B", "capacity": 40},
    {"code": "2F-A", "name": "Second Floor Room A", "capacity": 40},
    {"code": "2F-B", "name": "Second Floor Room B", "capacity": 40},
    {"code": "3F-A", "name": "Third Floor Room A", "capacity": 40},
    {"code": "3F-B", "name": "Third Floor Room B", "capacity": 40},
    {"code": "3F-C", "name": "Third Floor Room C", "capacity": 35},
]


class Command(BaseCommand):
    help = "Set up default school rooms if they don't exist"

    def handle(self, *args, **options):
        created_count = 0
        for room_data in DEFAULT_ROOMS:
            room, created = Room.objects.get_or_create(
                code=room_data["code"],
                defaults={
                    "name": room_data["name"],
                    "capacity": room_data["capacity"],
                    "is_active": True,
                }
            )
            if created:
                created_count += 1
                self.stdout.write(f"  Created room: {room.code}")
            else:
                self.stdout.write(f"  Room exists: {room.code}")
        
        self.stdout.write(
            self.style.SUCCESS(f"Setup complete. Created {created_count} new rooms.")
        )
