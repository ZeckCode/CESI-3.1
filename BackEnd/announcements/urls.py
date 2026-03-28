# announcements/urls.py
from django.urls import path
from .views import AnnouncementListCreate, announcement_media_raw

urlpatterns = [
    path('', AnnouncementListCreate.as_view(), name='announcements'),
    path('media/<int:pk>/', announcement_media_raw, name='announcement_media_raw'),
]
