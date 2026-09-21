from django.contrib import admin
from .models import AttendanceRecord


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ["student", "section", "date", "status", "marked_by", "updated_at"]
    list_filter = ["status", "section", "date"]
    search_fields = [
        "student__username",
        "student__email",
        "student__first_name",
        "student__last_name",
        "student__profile__student_first_name",
        "student__profile__student_last_name",
        "student__profile__student_number",
        "student__profile__lrn",
        "student__parent_enrollments__first_name",
        "student__parent_enrollments__last_name",
        "student__parent_enrollments__student_number",
        "student__parent_enrollments__lrn",
        "student__enrollments__first_name",
        "student__enrollments__last_name",
        "student__enrollments__student_number",
        "student__enrollments__lrn",
        "section__name",
        "subject__name",
        "subject__code",
    ]
    list_select_related = ["student", "section", "subject", "schedule", "marked_by"]
    ordering = ["-date", "section"]
    date_hierarchy = "date"

    def get_search_results(self, request, queryset, search_term):
        queryset, use_distinct = super().get_search_results(request, queryset, search_term)
        return queryset.distinct(), True
