from django.contrib import admin
from .models import Schedule, Room, SchoolYear


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "capacity", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    ordering = ("code",)


@admin.register(SchoolYear)
class SchoolYearAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
    ordering = ("-start_date",)


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ("id", "teacher", "subject", "section", "day_of_week", "start_time", "end_time", "room", "school_year")
    list_filter = ("day_of_week", "section", "subject", "room", "school_year")
    search_fields = ("teacher__username", "subject__name", "section__name")
    ordering = ("section", "day_of_week", "start_time")
