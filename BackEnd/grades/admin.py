from django.contrib import admin
from .models import GradeWeight, GradeItem, StudentScore, ClassStanding, AcademicRecord


@admin.register(GradeWeight)
class GradeWeightAdmin(admin.ModelAdmin):
    """Admin interface for GradeWeight model."""
    list_display = ('subject', 'activity_weight', 'quiz_weight', 'exam_weight', 'class_standing_weight', 'total')
    search_fields = ('subject__name',)
    readonly_fields = ('total',)
    fieldsets = (
        ('Subject', {
            'fields': ('subject',)
        }),
        ('Weight Distribution', {
            'fields': ('activity_weight', 'quiz_weight', 'exam_weight', 'class_standing_weight', 'total')
        }),
    )


class StudentScoreInline(admin.TabularInline):
    """Inline admin for StudentScore within GradeItem."""
    model = StudentScore    
    extra = 0
    readonly_fields = ('created_at', 'updated_at')
    fields = ('student', 'score', 'created_at', 'updated_at')


@admin.register(GradeItem)
class GradeItemAdmin(admin.ModelAdmin):
    """Admin interface for GradeItem model."""
    list_display = ('title', 'teacher', 'subject', 'get_category_display', 'quarter', 'grade_level', 'total_score', 'date_given')
    list_filter = ('category', 'quarter', 'grade_level', 'subject', 'teacher', 'created_at')
    search_fields = ('title', 'description', 'teacher__username', 'subject__name')
    readonly_fields = ('created_at',)
    inlines = [StudentScoreInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('teacher', 'subject', 'grade_level', 'title', 'description')
        }),
        ('Category & Timing', {
            'fields': ('category', 'quarter', 'date_given', 'due_date', 'order')
        }),
        ('Scoring', {
            'fields': ('total_score',)
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )

    def get_category_display(self, obj):
        return obj.get_category_display()
    get_category_display.short_description = 'Category'


@admin.register(StudentScore)
class StudentScoreAdmin(admin.ModelAdmin):
    """Admin interface for StudentScore model."""
    list_display = ('student', 'grade_item', 'score', 'max_score', 'percentage', 'updated_at')
    list_filter = ('grade_item__category', 'grade_item__quarter', 'grade_item__subject', 'created_at')
    search_fields = ('student__username', 'student__email', 'grade_item__title')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Student & Assessment', {
            'fields': ('student', 'grade_item')
        }),
        ('Score', {
            'fields': ('score',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def max_score(self, obj):
        return obj.grade_item.total_score
    max_score.short_description = 'Max Score'

    def percentage(self, obj):
        if obj.grade_item.total_score > 0:
            pct = (float(obj.score) / obj.grade_item.total_score) * 100
            return f"{pct:.1f}%"
        return "N/A"
    percentage.short_description = 'Percentage'


@admin.register(ClassStanding)
class ClassStandingAdmin(admin.ModelAdmin):
    """Admin interface for ClassStanding model."""
    list_display = ('student', 'subject', 'quarter', 'score')
    list_filter = ('quarter', 'subject')
    search_fields = ('student__username', 'student__email', 'subject__name')
    
    fieldsets = (
        ('Student & Subject', {
            'fields': ('student', 'subject')
        }),
        ('Standing', {
            'fields': ('quarter', 'score')
        }),
    )


@admin.register(AcademicRecord)
class AcademicRecordAdmin(admin.ModelAdmin):
    """Admin interface for AcademicRecord model."""
    list_display = ('student', 'school_year', 'grade_level', 'subject_name', 'final_grade', 'remarks', 'recorded_by')
    list_filter = ('school_year', 'grade_level', 'remarks', 'recorded_by', 'created_at')
    search_fields = ('student__username', 'student__email', 'subject_name', 'section_name')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Student Information', {
            'fields': ('student', 'recorded_by')
        }),
        ('Academic Details', {
            'fields': ('school_year', 'grade_level', 'section_name', 'subject_name', 'subject_code')
        }),
        ('Quarterly Grades', {
            'fields': ('q1', 'q2', 'q3', 'q4', 'final_grade')
        }),
        ('Status', {
            'fields': ('remarks', 'teacher_name')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
