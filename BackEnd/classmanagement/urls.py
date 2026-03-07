from django.urls import path
from .views import (
    ScheduleListCreate,
    ScheduleDetail,
    RoomListCreate,
    RoomDetail,
    SchoolYearListCreate,
    SchoolYearDetail,
    auto_generate_schedules,
    bulk_delete_schedules,
    bulk_update_schedules,
    my_schedule,
    activate_school_year,
    get_active_school_year,
)

urlpatterns = [
    # Schedules
    path("schedules/", ScheduleListCreate.as_view(), name="schedule-list"),
    path("schedules/<int:pk>/", ScheduleDetail.as_view(), name="schedule-detail"),
    path("schedules/auto-generate/", auto_generate_schedules, name="schedule-auto-generate"),
    path("schedules/bulk-delete/", bulk_delete_schedules, name="schedule-bulk-delete"),
    path("schedules/bulk-update/", bulk_update_schedules, name="schedule-bulk-update"),
    path("schedules/my/", my_schedule, name="my-schedule"),
    
    # Rooms
    path("rooms/", RoomListCreate.as_view(), name="room-list"),
    path("rooms/<int:pk>/", RoomDetail.as_view(), name="room-detail"),
    
    # School Years
    path("school-years/", SchoolYearListCreate.as_view(), name="school-year-list"),
    path("school-years/<int:pk>/", SchoolYearDetail.as_view(), name="school-year-detail"),
    path("school-years/<int:pk>/activate/", activate_school_year, name="school-year-activate"),
    path("school-years/active/", get_active_school_year, name="school-year-active"),
]
