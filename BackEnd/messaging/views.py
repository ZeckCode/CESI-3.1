from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q, Count
import re

from .models import (
    ProfanityWord, Chat, ChatMember, Message, ChatRestriction, MessageFlag,
    ChatRequest, MessageReport, encrypt_message
)
from .serializers import (
    ProfanityWordSerializer, ChatListSerializer, ChatDetailSerializer,
    ChatMemberSerializer, MessageSerializer, ChatRestrictionSerializer,
    MessageFlagSerializer, ChatCreateSerializer, MessageCreateSerializer,
    ChatRequestSerializer, ChatRequestCreateSerializer, MessageReportSerializer,
    MessageReportCreateSerializer
)
from accounts.models import User, Section, Subject


# ═══════════════════════════════════════════════════════════
# PROFANITY FILTERING UTILITIES
# ═══════════════════════════════════════════════════════════
def get_active_profanity_words():
    """Get all active profanity words (cached in production)."""
    return list(ProfanityWord.objects.filter(is_active=True).values_list('word', flat=True))


def check_profanity(text):
    """
    Scan text for profanity.
    Returns: (is_flagged, flagged_words, censored_text)
    """
    if not text:
        return False, [], text

    active_words = get_active_profanity_words()
    flagged = []
    censored = text

    for word in active_words:
        pattern = rf'\b{re.escape(word)}\b'
        matches = re.finditer(pattern, censored, re.IGNORECASE)
        
        for match in matches:
            if word.lower() not in [w.lower() for w in flagged]:
                flagged.append(match.group())
        
        # Censor the word
        censored = re.sub(pattern, '*' * len(word), censored, flags=re.IGNORECASE)

    return len(flagged) > 0, flagged, censored


# ═══════════════════════════════════════════════════════════
# PROFANITY WORD MANAGEMENT (Admin Only)
# ═══════════════════════════════════════════════════════════
class ProfanityWordViewSet(viewsets.ModelViewSet):
    """Admin-only profanity word management."""
    queryset = ProfanityWord.objects.all()
    serializer_class = ProfanityWordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only admins can manage profanity
        if self.request.user.role != 'ADMIN':
            return ProfanityWord.objects.none()
        return super().get_queryset()

    def create(self, request, *args, **kwargs):
        if request.user.role != 'ADMIN':
            return Response(
                {'detail': 'Only admins can add profanity words.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.role != 'ADMIN':
            return Response(
                {'detail': 'Only admins can edit profanity words.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'ADMIN':
            return Response(
                {'detail': 'Only admins can delete profanity words.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


# ═══════════════════════════════════════════════════════════
# CHAT MANAGEMENT
# ═══════════════════════════════════════════════════════════
class ChatViewSet(viewsets.ModelViewSet):
    """Manage chats (create, list, detail)."""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter chats user is member of."""
        user = self.request.user
        qs = Chat.objects.filter(
            (Q(members__user=user) | Q(creator=user)) & Q(is_active=True)
        ).distinct().prefetch_related('members__user')
        if getattr(self, 'action', None) == 'retrieve':
            qs = qs.prefetch_related('messages__sender')
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ChatDetailSerializer
        elif self.action == 'create':
            return ChatCreateSerializer
        return ChatListSerializer

    def create(self, request, *args, **kwargs):
        """Create a new chat (individual or group)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        chat_type = serializer.validated_data.get('chat_type')

        # Validation
        if chat_type == 'INDIVIDUAL':
            # Only creator, with one participant_two
            participant_two = serializer.validated_data.get('participant_two')
            if not participant_two:
                return Response(
                    {'detail': 'Individual chat requires participant_two.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if chat already exists
            existing = Chat.objects.filter(
                chat_type='INDIVIDUAL',
                creator=request.user,
                participant_two=participant_two
            ).first()
            if existing:
                # Ensure both users are in ChatMember (in case they were somehow removed)
                ChatMember.objects.get_or_create(chat=existing, user=request.user)
                ChatMember.objects.get_or_create(chat=existing, user=participant_two)
                return Response(
                    ChatDetailSerializer(existing).data,
                    status=status.HTTP_200_OK
                )

        elif chat_type == 'GROUP_CLASS':
            # Teachers and parent/student accounts can create class groups
            if request.user.role not in ['TEACHER', 'PARENT_STUDENT']:
                return Response(
                    {'detail': 'Only teachers or parent/student users can create class group chats.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            # Requires section + subject
            section = serializer.validated_data.get('section')
            subject = serializer.validated_data.get('subject')
            if not section or not subject:
                return Response(
                    {'detail': 'Class chat requires section and subject.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        elif chat_type == 'GROUP_PROJECT':
            # Students/teachers can create
            pass

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        """Create chat and auto-add members."""
        chat = serializer.save()

        if chat.chat_type == 'INDIVIDUAL':
            # Add both users
            ChatMember.objects.get_or_create(chat=chat, user=chat.creator)
            ChatMember.objects.get_or_create(chat=chat, user=chat.participant_two)

        elif chat.chat_type == 'GROUP_CLASS':
            # Auto-add all students in section + teacher
            from enrollment.models import Enrollment
            
            students = Enrollment.objects.filter(
                section=chat.section,
                status="ACTIVE"
            ).values_list('student_id', flat=True)

            # Add teacher
            ChatMember.objects.create(chat=chat, user=chat.creator, is_admin=True)

            # Add students
            for student_id in students:
                ChatMember.objects.create(chat=chat, user_id=student_id, is_admin=False)

        elif chat.chat_type == 'GROUP_PROJECT':
            # Only add creator
            ChatMember.objects.create(chat=chat, user=chat.creator, is_admin=True)

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        """Add member to group chat."""
        chat = self.get_object()
        user_id = request.data.get('user_id')

        # Only creator/admins can add
        is_creator = chat.creator_id == request.user.id
        is_admin_member = ChatMember.objects.filter(chat=chat, user=request.user, is_admin=True).exists()
        if not (is_creator or is_admin_member):
            return Response(
                {'detail': 'Only admins can add members.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            user = User.objects.get(id=user_id)
            member, created = ChatMember.objects.get_or_create(chat=chat, user=user)
            return Response(
                ChatMemberSerializer(member).data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        """Remove member from group chat."""
        chat = self.get_object()
        user_id = request.data.get('user_id')

        # Only creator/admins can remove
        is_creator = chat.creator_id == request.user.id
        is_admin_member = ChatMember.objects.filter(chat=chat, user=request.user, is_admin=True).exists()
        if not (is_creator or is_admin_member):
            return Response(
                {'detail': 'Only admins can remove members.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            member = ChatMember.objects.get(chat=chat, user_id=user_id)
            member.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ChatMember.DoesNotExist:
            return Response(
                {'detail': 'Member not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, *args, **kwargs):
        """Delete a chat (creator only)."""
        chat = self.get_object()
        if chat.creator_id != request.user.id:
            return Response(
                {'detail': 'Only the chat creator can delete this conversation.'},
                status=status.HTTP_403_FORBIDDEN
            )

        chat.is_active = False
        chat.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def search_users(self, request):
        """Search for users to add to chat (autofill)."""
        query = request.query_params.get('q', '').strip()
        if not query or len(query) < 2:
            return Response(
                {'detail': 'Query must be at least 2 characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Custom User model stores names in related profile for parent/student accounts.
        base_queryset = User.objects.filter(
            Q(username__icontains=query) |
            Q(email__icontains=query) |
            Q(profile__student_first_name__icontains=query) |
            Q(profile__student_last_name__icontains=query) |
            Q(profile__parent_first_name__icontains=query) |
            Q(profile__parent_last_name__icontains=query)
        ).exclude(id=request.user.id).distinct()

        # Student/parent accounts should primarily discover people in the same section.
        # This avoids unhelpful username-only global results.
        if request.user.role == 'PARENT_STUDENT':
            from enrollment.models import Enrollment
            from classmanagement.models import Schedule

            section_ids = set(
                Enrollment.objects.filter(
                    student=request.user,
                    status='ACTIVE',
                    section__isnull=False,
                ).values_list('section_id', flat=True)
            )

            # In some accounts, this user can be tied as parent_user.
            section_ids.update(
                Enrollment.objects.filter(
                    parent_user=request.user,
                    status='ACTIVE',
                    section__isnull=False,
                ).values_list('section_id', flat=True)
            )

            if section_ids:
                classmate_ids = set(
                    Enrollment.objects.filter(
                        section_id__in=section_ids,
                        status='ACTIVE',
                    ).values_list('student_id', flat=True)
                )
                teacher_ids = set(
                    Schedule.objects.filter(
                        section_id__in=section_ids
                    ).values_list('teacher_id', flat=True)
                )
                scoped_ids = classmate_ids.union(teacher_ids)
                base_queryset = base_queryset.filter(id__in=scoped_ids)

        queryset = base_queryset[:10]

        users = []
        for user in queryset:
            first_name = ''
            last_name = ''

            # Keep frontend contract: return first_name/last_name fields.
            if hasattr(user, 'profile') and user.profile:
                first_name = user.profile.student_first_name or user.profile.parent_first_name or ''
                last_name = user.profile.student_last_name or user.profile.parent_last_name or ''

            users.append({
                'id': user.id,
                'display_name': f"{first_name} {last_name}".strip() or user.username,
                'username': user.username,
                'first_name': first_name,
                'last_name': last_name,
                'role': user.role,
            })

        return Response(users)

    @action(detail=False, methods=['get'])
    def search_sections(self, request):
        """Search for sections (autofill for class chats)."""
        query = request.query_params.get('q', '').strip()
        if not query or len(query) < 1:
            # Return all if no query
            sections = Section.objects.all().values('id', 'name', 'grade_level')[:10]
        else:
            sections = Section.objects.filter(
                Q(name__icontains=query) |
                Q(grade_level__icontains=query)
            ).values('id', 'name', 'grade_level')[:10]

        return Response(list(sections))

    @action(detail=False, methods=['get'])
    def search_subjects(self, request):
        """Search for subjects (autofill for class chats)."""
        query = request.query_params.get('q', '').strip()
        if not query or len(query) < 1:
            subjects = Subject.objects.all().values('id', 'name')[:10]
        else:
            subjects = Subject.objects.filter(
                name__icontains=query
            ).values('id', 'name')[:10]

        return Response(list(subjects))

# ═══════════════════════════════════════════════════════════
# MESSAGE MANAGEMENT
# ═══════════════════════════════════════════════════════════
class MessageViewSet(viewsets.ModelViewSet):
    """Manage messages (create, list, delete)."""
    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        """
        Get messages visible to the current user.

        Admins can see all messages (for moderation).
        Non-admin users are limited to messages in chats they belong to.
        """
        user = self.request.user
        if getattr(user, 'role', None) == 'ADMIN':
            return Message.objects.all().prefetch_related('sender')
        user_chats = Chat.objects.filter(
            Q(members__user=user) | Q(creator=user)
        ).values_list('id', flat=True)
        return Message.objects.filter(chat_id__in=user_chats).prefetch_related('sender')

    def get_serializer_class(self):
        if self.action == 'create':
            return MessageCreateSerializer
        return MessageSerializer

    def create(self, request, *args, **kwargs):
        """Send a message with profanity checking."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        chat_id = serializer.validated_data.get('chat').id
        try:
            chat = Chat.objects.get(id=chat_id)
        except Chat.DoesNotExist:
            return Response(
                {'detail': 'Chat not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if user is member or creator
        is_member = ChatMember.objects.filter(chat=chat, user=request.user).exists()
        is_creator = chat.creator_id == request.user.id
        
        if not (is_member or is_creator):
            return Response(
                {'detail': 'You are not a member of this chat.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Ensure creator is in ChatMember (in case somehow missing)
        if is_creator and not is_member:
            ChatMember.objects.get_or_create(chat=chat, user=request.user)

        # Check if user is restricted
        restriction = ChatRestriction.objects.filter(
            chat=chat,
            user=request.user,
            restriction_type='PERMANENT_REMOVE'
        ).first()
        if restriction:
            return Response(
                {'detail': 'You have been removed from this chat.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check temp mute
        temp_restriction = ChatRestriction.objects.filter(
            chat=chat,
            user=request.user,
            restriction_type='TEMP_MUTE',
            expires_at__gt=timezone.now()
        ).first()
        if temp_restriction:
            return Response(
                {
                    'detail': f'You are temporarily muted until {temp_restriction.expires_at}.',
                    'expires_at': temp_restriction.expires_at
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Check profanity & censor
        content = serializer.validated_data.get('content', '') or ''
        is_flagged, flagged_words, censored_content = check_profanity(content)

        # Image check: teachers only
        image = serializer.validated_data.get('image')
        if image and request.user.role != 'TEACHER':
            return Response(
                {'detail': 'Only teachers can send images.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Create message
        message = Message(
            chat=chat,
            sender=request.user,
            image=image,
            is_flagged=is_flagged,
            flagged_words=','.join(flagged_words) if flagged_words else '',
            school_year=chat.school_year
        )
        if censored_content:
            message.content = censored_content  # Encrypt censored version
        message.save()

        # Create flag if profanity detected
        if is_flagged:
            MessageFlag.objects.create(
                message=message,
                chat=chat,
                flagged_words=','.join(flagged_words)
            )

        return Response(
            MessageSerializer(message).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['delete'])
    def delete_by_admin(self, request, pk=None):
        """Admin deletes a message."""
        if request.user.role != 'ADMIN':
            return Response(
                {'detail': 'Only admins can delete messages.'},
                status=status.HTTP_403_FORBIDDEN
            )

        message = self.get_object()
        reason = request.data.get('reason', '')

        message.is_deleted = True
        message.deleted_by = request.user
        message.deleted_at = timezone.now()
        message.deletion_reason = reason
        message.save()

        # Update flag status
        if hasattr(message, 'flag'):
            message.flag.status = 'DELETED'
            message.flag.reviewed_by = request.user
            message.flag.reviewed_at = timezone.now()
            message.flag.admin_notes = reason
            message.flag.save()

        return Response(
            {'detail': 'Message deleted.'},
            status=status.HTTP_200_OK
        )


# ═══════════════════════════════════════════════════════════
# ADMIN MODERATION
# ═══════════════════════════════════════════════════════════
class MessageFlagViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin views flagged messages."""
    permission_classes = [IsAuthenticated]
    serializer_class = MessageFlagSerializer

    def get_queryset(self):
        """Only admins can see flags."""
        if self.request.user.role != 'ADMIN':
            return MessageFlag.objects.none()
        return MessageFlag.objects.filter(status='PENDING').order_by('-flagged_at')

    @action(detail=True, methods=['post'])
    def take_action(self, request, pk=None):
        """Admin takes action on flagged message."""
        if request.user.role != 'ADMIN':
            return Response(
                {'detail': 'Only admins can review flags.'},
                status=status.HTTP_403_FORBIDDEN
            )

        flag = self.get_object()
        action_type = request.data.get('action')  # 'delete', 'restrict', 'approve', 'dismiss'
        admin_notes = request.data.get('admin_notes', '')

        if action_type == 'delete':
            flag.message.is_deleted = True
            flag.message.deleted_by = request.user
            flag.message.deleted_at = timezone.now()
            flag.message.save()
            flag.status = 'DELETED'

        elif action_type == 'restrict':
            # Accept both old (restriction_type/duration_hours) and new (is_permanent/restrict_duration)
            # field names to remain compatible with different client versions.
            is_permanent = request.data.get('is_permanent')
            restriction_type_field = request.data.get('restriction_type')

            if is_permanent is None:
                # Fall back to restriction_type field
                is_permanent = restriction_type_field != 'TEMP_MUTE'

            # Duration: accept both restrict_duration and duration_hours
            restrict_duration = request.data.get('restrict_duration') or request.data.get('duration_hours')

            restriction, created = ChatRestriction.objects.get_or_create(
                chat=flag.chat,
                user=flag.message.sender,
                defaults={
                    'restriction_type': 'PERMANENT_REMOVE' if is_permanent else 'TEMP_MUTE',
                    'restricted_by': request.user,
                    'reason': f"Flagged message with words: {flag.flagged_words}"
                }
            )

            if not is_permanent:
                # Update expiry for temp mute
                try:
                    duration_hours = int(restrict_duration or 24)
                except (TypeError, ValueError):
                    return Response(
                        {'detail': 'restrict_duration must be a valid number of hours.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                restriction.expires_at = timezone.now() + timedelta(hours=duration_hours)
                restriction.save()

            flag.status = 'USER_RESTRICTED'

        elif action_type == 'approve':
            flag.status = 'APPROVED'

        elif action_type == 'dismiss':
            flag.status = 'DISMISSED'

        flag.reviewed_by = request.user
        flag.reviewed_at = timezone.now()
        flag.admin_notes = admin_notes
        flag.save()

        return Response(
            MessageFlagSerializer(flag).data,
            status=status.HTTP_200_OK
        )


class ChatRestrictionViewSet(viewsets.ModelViewSet):
    """Admin manages chat restrictions."""
    permission_classes = [IsAuthenticated]
    serializer_class = ChatRestrictionSerializer

    def get_queryset(self):
        """Only admins can manage restrictions."""
        if self.request.user.role != 'ADMIN':
            return ChatRestriction.objects.none()
        return ChatRestriction.objects.all()

    def create(self, request, *args, **kwargs):
        """Admin creates a restriction."""
        if request.user.role != 'ADMIN':
            return Response(
                {'detail': 'Only admins can create restrictions.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def lift_restriction(self, request, pk=None):
        """Admin lifts a restriction."""
        if request.user.role != 'ADMIN':
            return Response(
                {'detail': 'Only admins can lift restrictions.'},
                status=status.HTTP_403_FORBIDDEN
            )

        restriction = self.get_object()
        restriction.delete()
        return Response(
            {'detail': 'Restriction lifted.'},
            status=status.HTTP_200_OK
        )


# ═══════════════════════════════════════════════════════════
# CHAT REQUESTS (Student Safety)
# ═══════════════════════════════════════════════════════════
class ChatRequestViewSet(viewsets.ModelViewSet):
    """Students request 1-on-1 chats with other students."""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return ChatRequestCreateSerializer
        return ChatRequestSerializer

    def get_queryset(self):
        """Students see requests they receive or sent."""
        queryset = ChatRequest.objects.filter(
            Q(recipient=self.request.user) | Q(requester=self.request.user)
        )
        status_filter = self.request.query_params.get('status')

        # For pending items, show only requests that the current user can act on.
        if status_filter and status_filter.upper() == 'PENDING':
            queryset = queryset.filter(recipient=self.request.user)

        return queryset

    def create(self, request, *args, **kwargs):
        """Student creates a chat request."""
        recipient_id = request.data.get('recipient')
        first_message = (request.data.get('first_message') or '').strip()

        # Validate
        if not recipient_id:
            return Response(
                {'detail': 'recipient is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            recipient_id_int = int(recipient_id)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'recipient must be a valid integer ID.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            recipient = User.objects.get(id=recipient_id_int)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Recipient not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Reuse existing request row (unique_together requester+recipient)
        existing_request = ChatRequest.objects.filter(
            requester=request.user,
            recipient=recipient
        ).select_related('chat').first()

        if existing_request and existing_request.status == 'PENDING':
            return Response(
                {'detail': 'Chat request already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if existing_request and existing_request.status in ['ACCEPTED', 'DECLINED']:
            existing_request.status = 'PENDING'
            existing_request.responded_at = None
            existing_request.first_message = first_message
            existing_request.save(update_fields=['status', 'responded_at', 'first_message'])

            # Ensure chat is visible again for both users
            if not existing_request.chat.is_active:
                existing_request.chat.is_active = True
                existing_request.chat.save(update_fields=['is_active'])

            return Response(
                ChatRequestSerializer(existing_request).data,
                status=status.HTTP_200_OK
            )

        # Create individual chat if it doesn't exist
        chat, created = Chat.objects.get_or_create(
            chat_type='INDIVIDUAL',
            creator=request.user,
            participant_two=recipient,
            defaults={'school_year': request.data.get('school_year', '')}
        )

        # Add members
        if created:
            ChatMember.objects.get_or_create(chat=chat, user=request.user)
            ChatMember.objects.get_or_create(chat=chat, user=recipient)

        # Create chat request
        chat_request = ChatRequest.objects.create(
            chat=chat,
            requester=request.user,
            recipient=recipient,
            first_message=first_message
        )

        return Response(
            ChatRequestSerializer(chat_request).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def respond(self, request, pk=None):
        """Student responds to a chat request."""
        chat_request = self.get_object()

        # Only the recipient can respond
        if request.user != chat_request.recipient:
            return Response(
                {'detail': 'Only the recipient can respond.'},
                status=status.HTTP_403_FORBIDDEN
            )

        action = request.data.get('action')  # 'accept' or 'decline'

        if action == 'accept':
            chat_request.status = 'ACCEPTED'
            chat_request.responded_at = timezone.now()
            chat_request.save()

            return Response(
                ChatRequestSerializer(chat_request).data,
                status=status.HTTP_200_OK
            )

        elif action == 'decline':
            chat_request.status = 'DECLINED'
            chat_request.responded_at = timezone.now()
            chat_request.save()

            # Hide the chat for both users
            chat_request.chat.is_active = False
            chat_request.chat.save()

            return Response(
                {'detail': 'Chat request declined.'},
                status=status.HTTP_200_OK
            )

        else:
            return Response(
                {'detail': 'action must be "accept" or "decline".'},
                status=status.HTTP_400_BAD_REQUEST
            )


# ═══════════════════════════════════════════════════════════
# MESSAGE REPORTS (User Safety)
# ═══════════════════════════════════════════════════════════
class MessageReportViewSet(viewsets.ModelViewSet):
    """Users report inappropriate messages."""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return MessageReportCreateSerializer
        return MessageReportSerializer

    def get_queryset(self):
        """Admins see all reports, users see their own."""
        if self.request.user.role == 'ADMIN':
            return MessageReport.objects.all()
        return MessageReport.objects.filter(reporter=self.request.user)

    def create(self, request, *args, **kwargs):
        """User creates a message report."""
        message_id = request.data.get('message')
        reason = request.data.get('reason')
        description = request.data.get('description', '')

        try:
            message = Message.objects.get(id=message_id)
        except Message.DoesNotExist:
            return Response(
                {'detail': 'Message not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if user already reported this message
        if MessageReport.objects.filter(
            message=message,
            reporter=request.user
        ).exists():
            return Response(
                {'detail': 'You already reported this message.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create report
        report = MessageReport.objects.create(
            message=message,
            reporter=request.user,
            reason=reason,
            description=description
        )

        return Response(
            MessageReportSerializer(report).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """Admin reviews a message report."""
        if request.user.role != 'ADMIN':
            return Response(
                {'detail': 'Only admins can review reports.'},
                status=status.HTTP_403_FORBIDDEN
            )

        report = self.get_object()
        action = request.data.get('action')  # 'approve', 'dismiss', 'delete'
        admin_notes = request.data.get('admin_notes', '')

        if action == 'delete':
            # Delete the reported message
            report.message.is_deleted = True
            report.message.deleted_by = request.user
            report.message.deleted_at = timezone.now()
            report.message.deletion_reason = 'Deleted by admin due to report'
            report.message.save()
            report.status = 'RESOLVED'

        elif action == 'dismiss':
            report.status = 'DISMISSED'

        elif action == 'approve':
            report.status = 'REVIEWED'

        else:
            return Response(
                {'detail': 'action must be "approve", "dismiss", or "delete".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.admin_notes = admin_notes
        report.save()

        return Response(
            MessageReportSerializer(report).data,
            status=status.HTTP_200_OK
        )
