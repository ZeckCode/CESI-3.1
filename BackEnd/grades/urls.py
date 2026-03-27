from django.urls import path
from . import views

urlpatterns = [
    # Root
    path("", views.grades_root, name="grades-root"),

    # Teacher info
    path("teacher-info/", views.teacher_info, name="teacher-info"),
    path("my-sections/", views.teacher_sections, name="grade-teacher-sections"),
    path("section-performance/", views.section_performance, name="section-performance"),
    path("admin-monitoring/", views.admin_grade_records_monitoring, name="admin-grade-monitoring"),

    # Weights
    path("weights/<int:subject_id>/", views.get_weights, name="grade-weights"),
    path("weights/<int:subject_id>/update/", views.update_weights, name="grade-weights-update"),

    # Grade Items (activities, quizzes, exams)
    path("items/", views.GradeItemListCreate.as_view(), name="grade-item-list"),
    path("items/<int:pk>/", views.GradeItemDetail.as_view(), name="grade-item-detail"),

    # Student scores
    path("scores/", views.StudentScoreListCreate.as_view(), name="score-list"),
    path("scores/upsert/", views.upsert_score, name="score-upsert"),

    # Class standing
    path("class-standing/", views.list_class_standings, name="class-standing-list"),
    path("class-standing/upsert/", views.upsert_class_standing, name="class-standing-upsert"),

    # Students by grade
    path("students/<int:grade_level>/", views.students_by_grade, name="students-by-grade"),
    path("students/section/<int:section_id>/", views.students_by_section, name="students-by-section"),

    # Computed grades
    path("compute/<int:student_id>/<int:subject_id>/", views.student_quarter_grades, name="student-quarter-grades"),

    # Parent — my child's report card
    path("my-grades/", views.my_grades, name="my-grades"),

    # Academic History (historical records for old/returning students)
    path("my-academic-history/", views.my_academic_history, name="my-academic-history"),
    path("academic-history/", views.AcademicRecordListCreate.as_view(), name="academic-history-list"),
    path("academic-history/<int:pk>/", views.AcademicRecordDetail.as_view(), name="academic-history-detail"),
    path("publish-history/", views.publish_academic_history, name="publish-academic-history"),

    # Admin — re-enrollment eligibility check for students
    path("my-reenrollment-eligibility/", views.my_reenrollment_eligibility, name="my-reenrollment-eligibility"),

]
