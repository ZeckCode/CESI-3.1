# announcements/urls.py
from django.urls import path
from .views import AnnouncementListCreate, AnnouncementDetail, announcement_media_raw

urlpatterns = [
    path('', AnnouncementListCreate.as_view(), name='announcements'),
    path('<int:pk>/', AnnouncementDetail.as_view(), name='announcement_detail'),
    path('media/<int:pk>/', announcement_media_raw, name='announcement_media_raw'),
]
