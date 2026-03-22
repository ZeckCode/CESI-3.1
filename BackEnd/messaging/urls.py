from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChatViewSet, MessageViewSet, MessageFlagViewSet, 
    ChatRestrictionViewSet, ProfanityWordViewSet, ChatRequestViewSet,
    MessageReportViewSet
)

router = DefaultRouter()
router.register(r'chats', ChatViewSet, basename='chat')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'flags', MessageFlagViewSet, basename='messageflag')
router.register(r'restrictions', ChatRestrictionViewSet, basename='chatrestriction')
router.register(r'profanity', ProfanityWordViewSet, basename='profanityword')
router.register(r'chat-requests', ChatRequestViewSet, basename='chatrequest')
router.register(r'reports', MessageReportViewSet, basename='messagereport')

urlpatterns = [
    path('', include(router.urls)),
]
