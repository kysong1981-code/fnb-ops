from rest_framework import serializers
from .models import (
    TemperatureLocation, CleaningArea,
    SafetyChecklistTemplate, DailyChecklistResponse,
    CleaningRecord, TemperatureRecord, TrainingRecord,
    SelfVerificationRecord, Incident, AuditLog,
    SafetyRecordType, StoreRecordConfig, SafetyRecord
)
from users.models import UserProfile


class TemperatureLocationSerializer(serializers.ModelSerializer):
    """온도 체크 위치 Serializer"""
    class Meta:
        model = TemperatureLocation
        fields = ['id', 'name', 'standard_min', 'standard_max', 'is_active', 'sort_order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CleaningAreaSerializer(serializers.ModelSerializer):
    """Cleaning Area Serializer"""
    class Meta:
        model = CleaningArea
        fields = ['id', 'name', 'is_active', 'sort_order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SafetyChecklistTemplateSerializer(serializers.ModelSerializer):
    """안전 체크리스트 템플릿 Serializer"""
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True)

    class Meta:
        model = SafetyChecklistTemplate
        fields = ['id', 'name', 'stage', 'items', 'is_active', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'created_by_name']


class DailyChecklistResponseSerializer(serializers.ModelSerializer):
    """일일 체크리스트 응답 Serializer"""
    template_name = serializers.CharField(source='template.name', read_only=True)
    completed_by_name = serializers.CharField(source='completed_by.user.get_full_name', read_only=True)
    completion_percentage = serializers.SerializerMethodField()

    class Meta:
        model = DailyChecklistResponse
        fields = [
            'id', 'template', 'template_name', 'organization', 'date',
            'completed_by', 'completed_by_name', 'responses', 'notes',
            'is_completed', 'completed_at', 'completion_percentage',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'template_name', 'completed_by_name']

    def get_completion_percentage(self, obj):
        """체크리스트 완료율 계산"""
        if not obj.responses:
            return 0
        completed = sum(1 for v in obj.responses.values() if v is True)
        total = len(obj.responses)
        return int((completed / total * 100)) if total > 0 else 0


class CleaningRecordSerializer(serializers.ModelSerializer):
    """청소 기록 Serializer"""
    cleaned_by_name = serializers.CharField(source='cleaned_by.user.get_full_name', read_only=True)

    class Meta:
        model = CleaningRecord
        fields = [
            'id', 'organization', 'date', 'area', 'cleaned_by', 'cleaned_by_name',
            'is_completed', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'cleaned_by_name', 'organization', 'cleaned_by']


class TemperatureRecordSerializer(serializers.ModelSerializer):
    """온도 기록 Serializer"""
    recorded_by_name = serializers.CharField(source='recorded_by.user.get_full_name', read_only=True)
    status = serializers.SerializerMethodField()
    is_within_standard = serializers.SerializerMethodField()

    class Meta:
        model = TemperatureRecord
        fields = [
            'id', 'organization', 'date', 'time', 'location', 'temperature',
            'standard_temperature', 'recorded_by', 'recorded_by_name', 'notes',
            'status', 'is_within_standard', 'created_at'
        ]
        read_only_fields = ['created_at', 'recorded_by_name', 'status', 'is_within_standard', 'organization', 'recorded_by']

    def get_status(self, obj):
        """온도 상태 판별 (정상/경고/위험)"""
        if obj.standard_temperature is None:
            return 'unknown'

        tolerance = 2.0  # 허용 범위 ±2도
        if abs(obj.temperature - obj.standard_temperature) <= tolerance:
            return 'normal'
        elif abs(obj.temperature - obj.standard_temperature) <= tolerance + 2:
            return 'warning'
        else:
            return 'critical'

    def get_is_within_standard(self, obj):
        """표준 온도 범위 내인지 확인"""
        if obj.standard_temperature is None:
            return None
        return abs(obj.temperature - obj.standard_temperature) <= 2.0


class TrainingRecordSerializer(serializers.ModelSerializer):
    """교육 기록 Serializer"""
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True)
    participants_count = serializers.SerializerMethodField()
    days_until_expiry = serializers.SerializerMethodField()

    class Meta:
        model = TrainingRecord
        fields = [
            'id', 'organization', 'date', 'title', 'description',
            'validity_months', 'expiry_date', 'participants', 'created_by',
            'created_by_name', 'participants_count', 'days_until_expiry',
            'created_at'
        ]
        read_only_fields = ['created_at', 'created_by_name', 'participants_count', 'days_until_expiry']

    def get_participants_count(self, obj):
        """참석자 수"""
        return obj.participants.count()

    def get_days_until_expiry(self, obj):
        """만료까지 남은 일수"""
        if obj.expiry_date is None:
            return None
        from datetime import date
        return (obj.expiry_date - date.today()).days


class SelfVerificationSerializer(serializers.ModelSerializer):
    """자체 검증 기록 Serializer"""
    verified_by_name = serializers.CharField(source='verified_by.user.get_full_name', read_only=True)
    compliance_score = serializers.SerializerMethodField()

    class Meta:
        model = SelfVerificationRecord
        fields = [
            'id', 'organization', 'frequency', 'period_start', 'period_end',
            'checklist', 'responses', 'findings', 'corrective_actions',
            'verified_by', 'verified_by_name', 'verified_at', 'compliance_score',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'verified_by_name', 'compliance_score']

    def get_compliance_score(self, obj):
        """규정 준수 점수 계산 (0-100)"""
        if not obj.responses:
            return 0
        compliant = sum(1 for v in obj.responses.values() if v is True)
        total = len(obj.responses)
        return int((compliant / total * 100)) if total > 0 else 0


class IncidentSerializer(serializers.ModelSerializer):
    """사건/불만 기록 Serializer"""
    reported_by_name = serializers.CharField(source='reported_by.user.get_full_name', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.user.get_full_name', read_only=True, allow_null=True)
    days_open = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            'id', 'organization', 'title', 'description', 'severity', 'status',
            'incident_type', 'reported_by', 'reported_by_name', 'reported_at',
            'resolved_by', 'resolved_by_name', 'resolution_notes', 'resolved_at',
            'days_open', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'reported_by_name', 'resolved_by_name', 'days_open']

    def get_days_open(self, obj):
        """현재까지 열려있는 일수"""
        from datetime import datetime
        if obj.resolved_at:
            return (obj.resolved_at - obj.reported_at).days
        return (datetime.now() - obj.reported_at).days if hasattr(obj.reported_at, 'date') else None


class AuditLogSerializer(serializers.ModelSerializer):
    """감사 기록 Serializer"""

    class Meta:
        model = AuditLog
        fields = [
            'id', 'organization', 'date', 'auditor_name', 'auditor_role',
            'audit_type', 'findings', 'overall_rating', 'recommendations',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class SafetyComplianceSummarySerializer(serializers.Serializer):
    """규정 준수 요약 Serializer (조회 전용)"""
    today_checklists = DailyChecklistResponseSerializer(many=True, read_only=True)
    recent_incidents = IncidentSerializer(many=True, read_only=True)
    outstanding_trainings = TrainingRecordSerializer(many=True, read_only=True)
    latest_temperature_records = TemperatureRecordSerializer(many=True, read_only=True)
    latest_cleaning_records = CleaningRecordSerializer(many=True, read_only=True)
    overall_compliance_score = serializers.FloatField(read_only=True)
    alerts = serializers.ListField(child=serializers.DictField(), read_only=True)


# ============================================================
# MPI Food Safety Record System Serializers
# ============================================================

class SafetyRecordTypeSerializer(serializers.ModelSerializer):
    """기록 유형 카탈로그 Serializer"""
    class Meta:
        model = SafetyRecordType
        fields = [
            'id', 'code', 'name', 'name_ko', 'description',
            'category', 'frequency', 'default_fields',
            'color_code', 'icon', 'sort_order',
            'is_system', 'is_active', 'legacy_model',
        ]
        read_only_fields = ['id', 'is_system']


class StoreRecordConfigSerializer(serializers.ModelSerializer):
    """매장별 기록 설정 Serializer"""
    record_type_detail = SafetyRecordTypeSerializer(source='record_type', read_only=True)

    class Meta:
        model = StoreRecordConfig
        fields = [
            'id', 'organization', 'record_type', 'record_type_detail',
            'is_enabled', 'assigned_role', 'custom_fields',
            'custom_schedule_time', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'created_at', 'updated_at']


class SafetyRecordSerializer(serializers.ModelSerializer):
    """완료된 식품안전 기록 Serializer"""
    completed_by_name = serializers.CharField(
        source='completed_by.user.get_full_name', read_only=True)
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.user.get_full_name', read_only=True,
        allow_null=True, default=None)
    record_type_detail = SafetyRecordTypeSerializer(
        source='record_type', read_only=True)

    class Meta:
        model = SafetyRecord
        fields = [
            'id', 'organization', 'record_type', 'record_type_detail',
            'date', 'time', 'completed_by', 'completed_by_name',
            'data', 'status', 'notes',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'organization', 'completed_by', 'completed_by_name',
            'reviewed_by_name', 'created_at', 'updated_at',
        ]


class SafetyRecordQuickCompleteSerializer(serializers.Serializer):
    """원탭 완료용 Serializer"""
    record_type = serializers.SlugRelatedField(
        slug_field='code',
        queryset=SafetyRecordType.objects.filter(is_active=True)
    )
    data = serializers.JSONField(default=dict)
    notes = serializers.CharField(required=False, default='', allow_blank=True)
