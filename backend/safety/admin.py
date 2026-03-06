from django.contrib import admin
from .models import (
    SafetyChecklistTemplate, DailyChecklistResponse,
    CleaningRecord, TemperatureRecord, TrainingRecord,
    SelfVerificationRecord, Incident, AuditLog
)


@admin.register(SafetyChecklistTemplate)
class SafetyChecklistTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'stage', 'organization', 'is_active', 'created_at')
    list_filter = ('stage', 'is_active', 'organization', 'created_at')
    search_fields = ('name', 'organization__name')
    ordering = ['-created_at']


@admin.register(DailyChecklistResponse)
class DailyChecklistResponseAdmin(admin.ModelAdmin):
    list_display = ('template', 'organization', 'date', 'completed_by', 'is_completed', 'created_at')
    list_filter = ('is_completed', 'date', 'organization', 'created_at')
    search_fields = ('organization__name', 'template__name')
    ordering = ['-date']
    readonly_fields = ('created_at', 'updated_at')


@admin.register(CleaningRecord)
class CleaningRecordAdmin(admin.ModelAdmin):
    list_display = ('organization', 'date', 'area', 'cleaned_by', 'is_completed', 'created_at')
    list_filter = ('is_completed', 'date', 'organization', 'created_at')
    search_fields = ('organization__name', 'area', 'notes')
    ordering = ['-date']
    readonly_fields = ('created_at', 'updated_at')


@admin.register(TemperatureRecord)
class TemperatureRecordAdmin(admin.ModelAdmin):
    list_display = ('organization', 'date', 'time', 'location', 'temperature', 'standard_temperature', 'recorded_by', 'created_at')
    list_filter = ('date', 'location', 'organization', 'created_at')
    search_fields = ('organization__name', 'location', 'notes')
    ordering = ['-date', '-time']
    readonly_fields = ('created_at',)


@admin.register(TrainingRecord)
class TrainingRecordAdmin(admin.ModelAdmin):
    list_display = ('organization', 'date', 'title', 'get_participants_count', 'expiry_date', 'created_by', 'created_at')
    list_filter = ('date', 'organization', 'expiry_date', 'created_at')
    search_fields = ('organization__name', 'title', 'description')
    ordering = ['-date']
    readonly_fields = ('created_at',)
    filter_horizontal = ('participants',)

    def get_participants_count(self, obj):
        return obj.participants.count()
    get_participants_count.short_description = 'Participants'


@admin.register(SelfVerificationRecord)
class SelfVerificationRecordAdmin(admin.ModelAdmin):
    list_display = ('organization', 'frequency', 'period_end', 'verified_by', 'verified_at', 'created_at')
    list_filter = ('frequency', 'period_end', 'organization', 'verified_at', 'created_at')
    search_fields = ('organization__name', 'findings', 'corrective_actions')
    ordering = ['-period_end']
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('organization', 'title', 'severity', 'status', 'incident_type', 'reported_by', 'reported_at', 'created_at')
    list_filter = ('severity', 'status', 'incident_type', 'reported_at', 'organization', 'created_at')
    search_fields = ('organization__name', 'title', 'description')
    ordering = ['-reported_at']
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('organization', 'date', 'audit_type', 'auditor_name', 'overall_rating', 'created_at')
    list_filter = ('audit_type', 'overall_rating', 'date', 'organization', 'created_at')
    search_fields = ('organization__name', 'auditor_name', 'recommendations')
    ordering = ['-date']
    readonly_fields = ('created_at', 'updated_at')
