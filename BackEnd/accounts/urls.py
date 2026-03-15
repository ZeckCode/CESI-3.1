from django.urls import path
from . import views
from .views import (
    LoginView,
    admin_data,
    teacher_data,
    parent_data,
    admin_create_user,
    me,
    me_detail,
    # detail,
    logout_view,
    SubjectListCreate,
    SubjectDetail,
    SectionListCreate,
    SectionDetail,
    user_list,
    update_teacher_assignment,
    update_student_profile,
    UpdateProfileView,
    PasswordResetRequestCreateView,
    AdminPasswordResetRequestListView,
    AdminSendPasswordResetLinkView,
    PasswordResetConfirmView,
    
)
from .views import SetPasswordView # Import the new view for password reset

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("admin-data/", admin_data, name="admin-data"),
    path("teacher-data/", teacher_data, name="teacher-data"),
    path("parent-data/", parent_data, name="parent-data"),
    path("admin/create-user/", admin_create_user, name="admin-create-user"),
    path("me/", me, name="me"),
    path("me/detail/", views.me_detail),
    path("me/update/", UpdateProfileView.as_view(), name="update-profile"),
    path("me/update/", UpdateProfileView.as_view(), name="me-update"),
    
    path("logout/", logout_view, name="logout"),

    # Subject CRUD
    path("subjects/", SubjectListCreate.as_view(), name="subject-list"),
    path("subjects/<int:pk>/", SubjectDetail.as_view(), name="subject-detail"),

    # Section CRUD
    path("sections/", SectionListCreate.as_view(), name="section-list"),
    path("sections/<int:pk>/", SectionDetail.as_view(), name="section-detail"),

    # User listing + teacher assignment
    path("users/", user_list, name="user-list"),
    path("users/<int:user_id>/assign/", update_teacher_assignment, name="update-teacher-assignment"),
    path("users/<int:user_id>/update-student/", update_student_profile, name="update-student-profile"),
   
    
    # Set new Password
    path("set-password/", SetPasswordView.as_view(), name="set-password"),
    path("set-password/<str:uidb64>/<str:token>/", SetPasswordView.as_view(), name="set-password"),

    # Forgot Password
    path("password-reset-request/", PasswordResetRequestCreateView.as_view(), name="password-reset-request"),
    path("admin/password-reset-requests/", AdminPasswordResetRequestListView.as_view(), name="admin-password-reset-requests"),
    path("admin/password-reset-requests/<int:pk>/send-link/", AdminSendPasswordResetLinkView.as_view(), name="admin-send-password-reset-link"),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),

]
