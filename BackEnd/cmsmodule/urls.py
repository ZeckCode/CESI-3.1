from django.urls import path
from .views import SchoolInformationView, MissionVisionView, ContactInquiryView

urlpatterns = [
    path('school-info/', SchoolInformationView.as_view(), name='school-info'),
    path('mission-vision/', MissionVisionView.as_view(), name='mission-vision'),
    path('contact-inquiry/', ContactInquiryView.as_view(), name='contact-inquiry'),
]