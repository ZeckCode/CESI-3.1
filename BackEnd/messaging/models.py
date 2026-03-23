from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from cryptography.fernet import Fernet
import os
import logging

User = get_user_model()

# ═══════════════════════════════════════════════════════════
# Encryption Helper
# ═══════════════════════════════════════════════════════════
logger = logging.getLogger(__name__)


def get_encryption_key():
    """
    Load the messaging encryption key from the MESSAGING_ENCRYPTION_KEY
    environment variable.  The key must be a valid Fernet key (base64-encoded
    32-byte value, e.g. generated once with Fernet.generate_key()).

    For local development the key can also be placed in a .env file loaded
    by python-decouple / django-environ.  In all cases the key must be set
    before startup – this function raises ImproperlyConfigured so the server
    fails fast rather than silently generating a new key on every restart
    (which would make all existing encrypted messages permanently unreadable).
    """
    from django.core.exceptions import ImproperlyConfigured

    key_env = os.getenv('MESSAGING_ENCRYPTION_KEY')
    if not key_env:
        raise ImproperlyConfigured(
            "MESSAGING_ENCRYPTION_KEY environment variable is not set. "
            "Generate a key with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\" "
            "and add it to your environment or .env file."
        )
    return key_env.encode() if isinstance(key_env, str) else key_env


def encrypt_message(text):
    """Encrypt message content.  Raises on failure to prevent plaintext storage."""
    if not text:
        return None
    cipher = Fernet(get_encryption_key())
    return cipher.encrypt(text.encode()).decode()


def decrypt_message(encrypted_text):
    """Decrypt message content.  Returns None and logs a warning on failure."""
    if not encrypted_text:
        return None
    try:
        cipher = Fernet(get_encryption_key())
        return cipher.decrypt(encrypted_text.encode()).decode()
    except Exception as e:
        logger.warning("Failed to decrypt message content: %s", e)
        return None



# ═══════════════════════════════════════════════════════════
# Profanity Word Management
# ═══════════════════════════════════════════════════════════
class ProfanityWord(models.Model):
    """Admin-managed list of profanity words to filter."""
    word = models.CharField(max_length=100, unique=True, db_index=True)
    category = models.CharField(
        max_length=50,
        choices=[
            ('SWEAR', 'Swear Words'),
            ('INSULT', 'Insults'),
            ('HARASSMENT', 'Harassment'),
            ('INAPPROPRIATE', 'Inappropriate Content'),
        ],
        default='SWEAR'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['word']
        verbose_name_plural = "Profanity Words"

    def __str__(self):
        return f"{self.word} ({self.get_category_display()})"


# ═══════════════════════════════════════════════════════════
# Chat Models
# ═══════════════════════════════════════════════════════════
class Chat(models.Model):
    """
    Represents a conversation (individual or group).
    Types:
    - INDIVIDUAL: 1-to-1 DM
    - GROUP_CLASS: Teacher-created group (section + subject)
    - GROUP_PROJECT: Student-created group (project/event collaboration)
    """
    CHAT_TYPE_CHOICES = [
        ('INDIVIDUAL', 'Individual (DM)'),
        ('GROUP_CLASS', 'Class Group (Teacher)'),
        ('GROUP_PROJECT', 'Project Group (Student)'),
    ]

    name = models.CharField(max_length=255, null=True, blank=True)
    chat_type = models.CharField(max_length=20, choices=CHAT_TYPE_CHOICES)
    
    # For class groups: link to Section + Subject
    section = models.ForeignKey(
        'accounts.Section',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='class_chats'
    )
    subject = models.ForeignKey(
        'accounts.Subject',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='class_chats'
    )
    
    # Creator (teacher for class groups, student for project groups)
    creator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_chats'
    )
    
    # For individual chats: participant 2
    participant_two = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='individual_chats'
    )
    
    school_year = models.CharField(
        max_length=12,
        help_text="e.g., 2023-2024",
        db_index=True
    )
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        unique_together = [
            ('section', 'subject', 'school_year'),  # One chat per subject per section per year
        ]

    def __str__(self):
        if self.chat_type == 'INDIVIDUAL':
            return f"DM: {self.creator.username} ↔ {self.participant_two.username}"
        elif self.chat_type == 'GROUP_CLASS':
            return f"{self.section.name} - {self.subject.name}"
        else:
            return self.name


class ChatMember(models.Model):
    """
    Tracks who is part of a chat.
    For class groups: Auto-added based on section enrollment.
    For project groups: Manually added by creator.
    """
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_memberships')
    
    # For group chats: track if user is admin (creator or teacher)
    is_admin = models.BooleanField(default=False)
    
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('chat', 'user')
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.user.username} in {self.chat}"


class Message(models.Model):
    """
    Represents a message in a chat.
    Content is encrypted server-side.
    """
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    
    # Encrypted content
    encrypted_content = models.TextField()
    
    # Image (optional, teachers only)
    image = models.ImageField(
        upload_to='messages/',
        null=True,
        blank=True,
        help_text="Teachers only"
    )
    
    # Profanity flag
    is_flagged = models.BooleanField(default=False)
    flagged_words = models.CharField(max_length=500, blank=True)
    
    # Admin can delete
    is_deleted = models.BooleanField(default=False)
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_messages'
    )
    deleted_at = models.DateTimeField(null=True, blank=True)
    deletion_reason = models.CharField(max_length=255, blank=True)
    
    school_year = models.CharField(max_length=12, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['chat', 'created_at']),
            models.Index(fields=['sender', 'created_at']),
        ]

    def __str__(self):
        return f"{self.sender.username} in {self.chat} at {self.created_at}"

    @property
    def content(self):
        """Decrypt and return message content."""
        return decrypt_message(self.encrypted_content)

    @content.setter
    def content(self, value):
        """Encrypt and store message content."""
        self.encrypted_content = encrypt_message(value)

    def save(self, *args, **kwargs):
        if not self.encrypted_content and hasattr(self, '_pending_content'):
            self.encrypted_content = encrypt_message(self._pending_content)
        super().save(*args, **kwargs)


class ChatRestriction(models.Model):
    """
    Admin restriction on a user in a specific chat.
    Can be temporary (time-based) or permanent (removal).
    """
    RESTRICTION_TYPE_CHOICES = [
        ('TEMP_MUTE', 'Temporary Mute'),
        ('PERMANENT_REMOVE', 'Permanent Removal'),
    ]

    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='restrictions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_restrictions')
    restriction_type = models.CharField(max_length=20, choices=RESTRICTION_TYPE_CHOICES)
    
    reason = models.TextField(blank=True)
    
    # For temp mute: when it expires
    expires_at = models.DateTimeField(null=True, blank=True)
    
    # Admin who applied restriction
    restricted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='applied_restrictions'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('chat', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.get_restriction_type_display()} in {self.chat}"

    @property
    def is_active(self):
        """Check if restriction is still active."""
        if self.restriction_type == 'PERMANENT_REMOVE':
            return True
        if self.expires_at:
            return timezone.now() < self.expires_at
        return True


class MessageFlag(models.Model):
    """
    Admin notification: flagged message waiting for review.
    """
    FLAG_STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved (No Action)'),
        ('DELETED', 'Message Deleted'),
        ('USER_RESTRICTED', 'User Restricted'),
        ('DISMISSED', 'Dismissed'),
    ]

    message = models.OneToOneField(Message, on_delete=models.CASCADE, related_name='flag')
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='message_flags')
    
    flagged_at = models.DateTimeField(auto_now_add=True)
    flagged_words = models.CharField(max_length=500)
    
    status = models.CharField(max_length=20, choices=FLAG_STATUS_CHOICES, default='PENDING')
    
    # Admin review
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_flags'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-flagged_at']

    def __str__(self):
        return f"Flag on {self.message.sender.username}'s message in {self.chat}"


# ═══════════════════════════════════════════════════════════
# Chat Request (For Student DM Safety)
# ═══════════════════════════════════════════════════════════
class ChatRequest(models.Model):
    """
    When a student initiates a 1-on-1 chat with another student,
    the recipient must accept the request before the chat appears.
    """
    chat = models.OneToOneField(Chat, on_delete=models.CASCADE, related_name='request')
    requester = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='chat_requests_sent'
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='chat_requests_received'
    )
    first_message = models.TextField(help_text="The initial message from requester")
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('ACCEPTED', 'Accepted'),
            ('DECLINED', 'Declined'),
        ],
        default='PENDING',
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('requester', 'recipient')
        ordering = ['-created_at']

    def __str__(self):
        return f"Chat request: {self.requester.username} → {self.recipient.username} ({self.status})"


# ═══════════════════════════════════════════════════════════
# Message Report (User Safety)
# ═══════════════════════════════════════════════════════════
class MessageReport(models.Model):
    """
    Users can report inappropriate messages to moderators.
    """
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reports')
    reporter = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='reports_filed'
    )
    reason = models.CharField(
        max_length=50,
        choices=[
            ('OFFENSIVE', 'Offensive Content'),
            ('BULLYING', 'Bullying'),
            ('HARASSMENT', 'Harassment'),
            ('INAPPROPRIATE', 'Inappropriate Content'),
            ('SPAM', 'Spam'),
            ('OTHER', 'Other'),
        ],
        db_index=True
    )
    description = models.TextField(blank=True, help_text="Additional context from reporter")
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending Review'),
            ('REVIEWED', 'Reviewed'),
            ('RESOLVED', 'Resolved'),
            ('DISMISSED', 'Dismissed'),
        ],
        default='PENDING',
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reports_reviewed'
    )
    admin_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('message', 'reporter')  # Prevent duplicate reports from same user

    def __str__(self):
        return f"Report on message by {self.message.sender.username}: {self.reason}"
