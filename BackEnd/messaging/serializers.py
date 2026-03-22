from rest_framework import serializers
from .models import (
    ProfanityWord, Chat, ChatMember, Message, ChatRestriction, MessageFlag,
    ChatRequest, MessageReport, decrypt_message
)
from accounts.models import User, Section, Subject


class ProfanityWordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfanityWord
        fields = ['id', 'word', 'category', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user info for chat display."""
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'display_name', 'username', 'email', 'role']

    def get_display_name(self, obj):
        # Prefer student name from profile for parent/student accounts.
        if hasattr(obj, 'profile') and obj.profile:
            first = getattr(obj.profile, 'student_first_name', '') or ''
            last = getattr(obj.profile, 'student_last_name', '') or ''
            full = f"{first} {last}".strip()
            if full:
                return full

            p_first = getattr(obj.profile, 'parent_first_name', '') or ''
            p_last = getattr(obj.profile, 'parent_last_name', '') or ''
            p_full = f"{p_first} {p_last}".strip()
            if p_full:
                return p_full

        return obj.username


class ChatMemberSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ChatMember
        fields = ['id', 'user', 'is_admin', 'joined_at']
        read_only_fields = ['id', 'joined_at']


class MessageSerializer(serializers.ModelSerializer):
    """Serialize messages with decryption."""
    sender = UserMinimalSerializer(read_only=True)
    content = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'chat', 'sender', 'content', 'image', 'is_flagged', 
            'flagged_words', 'is_deleted', 'created_at'
        ]
        read_only_fields = ['id', 'sender', 'is_flagged', 'is_deleted', 'created_at']

    def get_content(self, obj):
        """Return decrypted content if not deleted."""
        if obj.is_deleted:
            return "[Message deleted by admin]"
        return obj.content


class ChatListSerializer(serializers.ModelSerializer):
    """Lightweight chat list serializer."""
    section_name = serializers.CharField(source='section.name', read_only=True, allow_null=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True, allow_null=True)
    creator_name = serializers.CharField(source='creator.username', read_only=True)
    creator = UserMinimalSerializer(read_only=True)
    participant_two = UserMinimalSerializer(read_only=True, allow_null=True)
    other_participant = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = [
            'id', 'name', 'chat_type', 'section_name', 'subject_name',
            'creator_name', 'creator', 'participant_two', 'other_participant',
            'last_message', 'is_active', 'created_at', 'updated_at'
        ]

    def get_other_participant(self, obj):
        """Return the other user in individual chats for the current requester."""
        if obj.chat_type != 'INDIVIDUAL':
            return None

        request = self.context.get('request')
        current_user = getattr(request, 'user', None)

        if current_user and getattr(current_user, 'is_authenticated', False):
            if obj.creator_id == current_user.id:
                other = obj.participant_two
            else:
                other = obj.creator
        else:
            other = obj.participant_two or obj.creator

        return UserMinimalSerializer(other).data if other else None

    def get_last_message(self, obj):
        """Get the most recent message in chat."""
        last_msg = obj.messages.filter(is_deleted=False).last()
        if last_msg:
            return {
                'sender': last_msg.sender.username,
                'preview': last_msg.content[:50] + '...' if len(last_msg.content or '') > 50 else last_msg.content,
                'created_at': last_msg.created_at,
            }
        return None


class ChatDetailSerializer(serializers.ModelSerializer):
    """Detailed chat with members and messages."""
    section_name = serializers.CharField(source='section.name', read_only=True, allow_null=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True, allow_null=True)
    creator = UserMinimalSerializer(read_only=True)
    participant_two = UserMinimalSerializer(read_only=True, allow_null=True)
    members = ChatMemberSerializer(many=True, read_only=True)
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Chat
        fields = [
            'id', 'name', 'chat_type', 'section_name', 'subject_name',
            'creator', 'participant_two', 'members', 'messages',
            'is_active', 'created_at', 'updated_at', 'school_year'
        ]
        read_only_fields = ['creator', 'created_at', 'updated_at']


class ChatRestrictionSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)
    restricted_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ChatRestriction
        fields = ['id', 'chat', 'user', 'restriction_type', 'reason', 'expires_at', 'restricted_by', 'created_at']
        read_only_fields = ['id', 'created_at']


class MessageFlagSerializer(serializers.ModelSerializer):
    """Serialize flagged messages for admin review."""
    message = MessageSerializer(read_only=True)
    reviewed_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = MessageFlag
        fields = [
            'id', 'message', 'chat', 'flagged_at', 'flagged_words', 'status',
            'reviewed_by', 'reviewed_at', 'admin_notes'
        ]
        read_only_fields = ['id', 'flagged_at']


class ChatCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new chats."""
    class Meta:
        model = Chat
        fields = ['id', 'name', 'chat_type', 'section', 'subject', 'participant_two', 'school_year']
        read_only_fields = ['id']

    def create(self, validated_data):
        validated_data['creator'] = self.context['request'].user
        return super().create(validated_data)


class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating messages with encryption."""
    content = serializers.CharField(write_only=True)

    class Meta:
        model = Message
        fields = ['chat', 'content', 'image']

    def create(self, validated_data):
        content = validated_data.pop('content')
        validated_data['sender'] = self.context['request'].user
        validated_data['encrypted_content'] = None
        
        message = Message(**validated_data)
        message.content = content  # This triggers encryption via property setter
        message.save()
        return message


class ChatRequestSerializer(serializers.ModelSerializer):
    """Serialize chat requests for students."""
    requester = UserMinimalSerializer(read_only=True)
    recipient = UserMinimalSerializer(read_only=True)
    chat = ChatDetailSerializer(read_only=True)

    class Meta:
        model = ChatRequest
        fields = ['id', 'chat', 'requester', 'recipient', 'first_message', 'status', 'created_at']
        read_only_fields = ['id', 'requester', 'created_at']


class ChatRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating chat requests."""
    class Meta:
        model = ChatRequest
        fields = ['recipient', 'first_message']


class MessageReportSerializer(serializers.ModelSerializer):
    """Serialize message reports for admin review."""
    reporter = UserMinimalSerializer(read_only=True)
    message = MessageSerializer(read_only=True)
    reviewed_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = MessageReport
        fields = [
            'id', 'message', 'reporter', 'reason', 'description',
            'status', 'created_at', 'reviewed_by', 'reviewed_at', 'admin_notes'
        ]
        read_only_fields = ['id', 'reporter', 'created_at', 'reviewed_by', 'reviewed_at']


class MessageReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating message reports."""
    class Meta:
        model = MessageReport
        fields = ['message', 'reason', 'description']
