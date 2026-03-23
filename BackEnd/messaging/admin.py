from django.contrib import admin
from .models import (
    ProfanityWord, Chat, ChatMember, Message, ChatRestriction, MessageFlag,
    ChatRequest, MessageReport
)


@admin.register(ProfanityWord)
class ProfanityWordAdmin(admin.ModelAdmin):
    list_display = ('word', 'category', 'is_active', 'created_at')
    list_filter = ('category', 'is_active', 'created_at')
    search_fields = ('word',)
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Word Information', {
            'fields': ('word', 'category')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'chat_type', 'creator', 'school_year', 'is_active', 'created_at')
    list_filter = ('chat_type', 'is_active', 'created_at', 'school_year')
    search_fields = ('name', 'creator__username', 'section__name', 'subject__name')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'chat_type', 'creator', 'is_active')
        }),
        ('Class Group (if applicable)', {
            'fields': ('section', 'subject'),
            'classes': ('collapse',)
        }),
        ('Individual Chat (if applicable)', {
            'fields': ('participant_two',),
            'classes': ('collapse',)
        }),
        ('Academic', {
            'fields': ('school_year',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ChatMember)
class ChatMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'chat', 'is_admin', 'joined_at')
    list_filter = ('is_admin', 'joined_at')
    search_fields = ('user__username', 'chat__name')
    readonly_fields = ('joined_at',)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'chat', 'is_flagged', 'is_deleted', 'created_at')
    list_filter = ('is_flagged', 'is_deleted', 'created_at', 'school_year')
    search_fields = ('sender__username', 'chat__name', 'flagged_words')
    readonly_fields = ('sender', 'encrypted_content', 'created_at', 'deleted_at')
    
    fieldsets = (
        ('Message Information', {
            'fields': ('chat', 'sender', 'encrypted_content', 'image')
        }),
        ('Profanity Flagging', {
            'fields': ('is_flagged', 'flagged_words')
        }),
        ('Admin Actions', {
            'fields': ('is_deleted', 'deleted_by', 'deleted_at', 'deletion_reason')
        }),
        ('Metadata', {
            'fields': ('school_year', 'created_at'),
            'classes': ('collapse',)
        }),
    )

    def has_add_permission(self, request):
        return False


@admin.register(ChatRestriction)
class ChatRestrictionAdmin(admin.ModelAdmin):
    list_display = ('user', 'chat', 'restriction_type', 'is_active', 'created_at')
    list_filter = ('restriction_type', 'created_at')
    search_fields = ('user__username', 'chat__name')
    readonly_fields = ('created_at',)
    
    fieldsets = (
        ('Restriction Details', {
            'fields': ('chat', 'user', 'restriction_type', 'reason')
        }),
        ('Duration (for Temp Mute)', {
            'fields': ('expires_at',)
        }),
        ('Admin Info', {
            'fields': ('restricted_by', 'created_at'),
            'classes': ('collapse',)
        }),
    )

    def is_active(self, obj):
        return obj.is_active
    is_active.boolean = True


@admin.register(MessageFlag)
class MessageFlagAdmin(admin.ModelAdmin):
    list_display = ('message', 'chat', 'status', 'flagged_at', 'reviewed_by')
    list_filter = ('status', 'flagged_at')
    search_fields = ('message__sender__username', 'chat__name', 'flagged_words')
    readonly_fields = ('flagged_at', 'reviewed_at')
    
    fieldsets = (
        ('Flagged Message', {
            'fields': ('message', 'chat', 'flagged_words')
        }),
        ('Review Status', {
            'fields': ('status', 'flagged_at')
        }),
        ('Admin Review', {
            'fields': ('reviewed_by', 'reviewed_at', 'admin_notes')
        }),
    )

    def has_add_permission(self, request):
        return False


@admin.register(ChatRequest)
class ChatRequestAdmin(admin.ModelAdmin):
    list_display = ('requester', 'recipient', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('requester__username', 'recipient__username', 'chat__name')
    readonly_fields = ('created_at', 'responded_at', 'first_message')
    
    fieldsets = (
        ('Request Information', {
            'fields': ('requester', 'recipient', 'chat')
        }),
        ('First Message', {
            'fields': ('first_message',)
        }),
        ('Status', {
            'fields': ('status', 'created_at', 'responded_at')
        }),
    )

    def has_add_permission(self, request):
        return False


@admin.register(MessageReport)
class MessageReportAdmin(admin.ModelAdmin):
    list_display = ('reporter', 'message', 'reason', 'status', 'created_at')
    list_filter = ('reason', 'status', 'created_at')
    search_fields = ('reporter__username', 'message__sender__username', 'description')
    readonly_fields = ('created_at', 'reviewed_at')
    
    fieldsets = (
        ('Report Information', {
            'fields': ('message', 'reporter', 'reason', 'description')
        }),
        ('Review Status', {
            'fields': ('status', 'created_at')
        }),
        ('Admin Review', {
            'fields': ('reviewed_by', 'reviewed_at', 'admin_notes')
        }),
    )

