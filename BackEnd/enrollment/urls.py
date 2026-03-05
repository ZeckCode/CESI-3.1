from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EnrollmentViewSet
from enrollment.views import EnrollmentSettingsView

router = DefaultRouter()
router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")

urlpatterns = [
    path("", include(router.urls)),
    path("enrollment-settings/", EnrollmentSettingsView.as_view(), name="enrollment-settings"),  # ← removed api/
]