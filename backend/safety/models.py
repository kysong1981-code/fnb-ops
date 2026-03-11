from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from users.models import Organization, UserProfile


class TemperatureLocation(models.Model):
    """온도 체크 위치 (Store Settings에서 정의, 온도 기록 시 자동 표시)"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='temperature_locations')
    name = models.CharField(max_length=255, help_text="냉장고, 냉동고, 디스플레이 등")
    standard_min = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="기준 최저 온도 (°C)")
    standard_max = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="기준 최고 온도 (°C)")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']
        unique_together = ('organization', 'name')

    def __str__(self):
        return f"{self.name}"


class SafetyChecklistTemplate(models.Model):
    """안전 체크리스트 템플릿"""
    STAGE_CHOICES = [
        ('starting', 'Starting (시작)'),
        ('preparing', 'Preparing (준비)'),
        ('cooking', 'Making & Cooking (조리)'),
        ('serving', 'Serving & Selling (제공 및 판매)'),
        ('closing', 'Closing (종료)'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='checklist_templates')
    name = models.CharField(max_length=255)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    items = models.JSONField(default=list, help_text="Array of checklist items with description and required field")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='checklist_templates_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'stage', 'is_active']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.name}"


class DailyChecklistResponse(models.Model):
    """일일 안전 체크리스트 응답"""
    template = models.ForeignKey(SafetyChecklistTemplate, on_delete=models.PROTECT, related_name='responses')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='daily_checklists')
    date = models.DateField()
    completed_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='daily_checklists')

    # 응답 데이터
    responses = models.JSONField(default=dict, help_text="Dictionary of item_id -> response (true/false/note)")
    notes = models.TextField(blank=True, null=True)

    # 상태
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['organization', 'date']),
            models.Index(fields=['completed_by', 'date']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.template.name} - {self.date}"


class CleaningRecord(models.Model):
    """청소 기록"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='cleaning_records')

    # 청소 정보
    date = models.DateField()
    area = models.CharField(max_length=255)  # 주방, 식탁, 화장실 등
    cleaned_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='cleaning_records')

    # 상태
    is_completed = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['organization', 'date']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.area} - {self.date}"


class TemperatureRecord(models.Model):
    """온도 기록"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='temperature_records')

    # 온도 정보
    date = models.DateField()
    time = models.TimeField()
    location = models.CharField(max_length=255)  # 냉장고, 냉동고 등
    temperature = models.DecimalField(max_digits=5, decimal_places=1)
    standard_temperature = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    recorded_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='temperature_records')
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-time']
        indexes = [
            models.Index(fields=['organization', 'date']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.location} - {self.temperature}°C"


class TrainingRecord(models.Model):
    """직원 교육 기록"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='training_records')

    # 교육 정보
    date = models.DateField()
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    # 교육 유효 기간 관리
    validity_months = models.IntegerField(default=12, validators=[MinValueValidator(1), MaxValueValidator(60)])
    expiry_date = models.DateField(null=True, blank=True)

    # 참석자
    participants = models.ManyToManyField(UserProfile, related_name='training_records')

    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='trainings_created')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['organization', 'date']),
            models.Index(fields=['expiry_date']),
        ]

    def __str__(self):
        return f"{self.title} - {self.date}"


class SelfVerificationRecord(models.Model):
    """자체 검증 기록 (주간/월간 안전 점검)"""
    FREQUENCY_CHOICES = [
        ('weekly', '주간'),
        ('monthly', '월간'),
        ('quarterly', '분기'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='self_verifications')
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    period_start = models.DateField()
    period_end = models.DateField()

    # 검증 체크리스트 (JSON 형식)
    checklist = models.JSONField(default=dict, help_text="Comprehensive FCP checklist")
    responses = models.JSONField(default=dict, help_text="Verification responses")

    # 문제 사항
    findings = models.TextField(blank=True, null=True, help_text="Issues or concerns found")
    corrective_actions = models.TextField(blank=True, null=True, help_text="Actions taken to correct issues")

    # 검증자
    verified_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='self_verifications')
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-period_end']
        indexes = [
            models.Index(fields=['organization', 'period_end']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.get_frequency_display()} - {self.period_end}"


class Incident(models.Model):
    """사건/불만 기록"""
    STATUS_CHOICES = [
        ('reported', '보고됨'),
        ('investigating', '조사중'),
        ('resolved', '해결됨'),
        ('closed', '마감됨'),
    ]

    SEVERITY_CHOICES = [
        ('low', '낮음'),
        ('medium', '중간'),
        ('high', '높음'),
        ('critical', '긴급'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='incidents')

    # 사건 정보
    title = models.CharField(max_length=255)
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='reported')

    # 유형
    incident_type = models.CharField(max_length=50, choices=[
        ('customer_complaint', 'Customer Complaint'),
        ('food_safety', 'Food Safety Issue'),
        ('hygiene', 'Hygiene Issue'),
        ('equipment', 'Equipment Issue'),
        ('training', 'Training Issue'),
        ('other', 'Other'),
    ])

    # 보고자
    reported_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='incidents_reported')
    reported_at = models.DateTimeField(auto_now_add=True)

    # 해결
    resolved_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidents_resolved')
    resolution_notes = models.TextField(blank=True, null=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-reported_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['severity', 'reported_at']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.title} ({self.get_severity_display()})"


class AuditLog(models.Model):
    """감사 기록"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='audit_logs')

    # 감사 정보
    date = models.DateField()
    auditor_name = models.CharField(max_length=255)
    auditor_role = models.CharField(max_length=255)

    # 감사 범위
    audit_type = models.CharField(max_length=50, choices=[
        ('internal', 'Internal Audit'),
        ('external', 'External Audit'),
        ('regulatory', 'Regulatory Inspection'),
    ])

    # 감사 결과
    findings = models.JSONField(default=dict, help_text="Audit findings")
    overall_rating = models.CharField(max_length=20, choices=[
        ('excellent', 'Excellent'),
        ('good', 'Good'),
        ('satisfactory', 'Satisfactory'),
        ('needs_improvement', 'Needs Improvement'),
        ('non_compliant', 'Non-Compliant'),
    ], null=True, blank=True)

    # 권장사항
    recommendations = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['organization', 'date']),
            models.Index(fields=['audit_type']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.get_audit_type_display()} - {self.date}"


# ============================================================
# MPI Food Safety Record System
# ============================================================

class SafetyRecordType(models.Model):
    """MPI Food Safety Record Type 정의 (마스터 카탈로그)"""
    CATEGORY_CHOICES = [
        ('DAILY', 'Daily'),
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
        ('EVENT', 'Event-based'),
        ('SETUP', 'Setup/Reference'),
        ('SPECIALIST', 'Specialist'),
    ]

    FREQUENCY_CHOICES = [
        ('DAILY', 'Daily'),
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('ON_EVENT', 'On Event'),
        ('ONE_TIME', 'One Time'),
    ]

    code = models.CharField(max_length=50, unique=True, help_text="Unique slug: opening_checks, daily_temp, etc.")
    name = models.CharField(max_length=255)
    name_ko = models.CharField(max_length=255, blank=True, help_text="Korean name for bilingual display")
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)

    # Form schema
    default_fields = models.JSONField(
        default=list,
        help_text="Array of field definitions: [{key, label, label_ko, type, required, options}]"
    )

    # UI display
    color_code = models.CharField(max_length=7, default='#3B82F6', help_text="Hex color for UI")
    icon = models.CharField(max_length=50, default='clipboard', help_text="Icon key for frontend")
    sort_order = models.IntegerField(default=0)

    # System flag
    is_system = models.BooleanField(default=True, help_text="True = MPI-provided, False = custom")
    is_active = models.BooleanField(default=True)

    # Bridge to existing models
    legacy_model = models.CharField(
        max_length=50, blank=True,
        help_text="Existing model name to bridge: TemperatureRecord, CleaningRecord, etc."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'sort_order', 'name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class StoreRecordConfig(models.Model):
    """매장별 기록 유형 on/off 설정"""
    ROLE_CHOICES = [
        ('EMPLOYEE', 'Employee'),
        ('MANAGER', 'Manager'),
        ('BOTH', 'Both'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='safety_record_configs')
    record_type = models.ForeignKey(SafetyRecordType, on_delete=models.CASCADE, related_name='store_configs')
    is_enabled = models.BooleanField(default=True)
    assigned_role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='EMPLOYEE')

    # Store-specific overrides
    custom_fields = models.JSONField(default=list, blank=True, help_text="Override default_fields for this store")
    custom_schedule_time = models.TimeField(null=True, blank=True, help_text="Custom time for this task")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('organization', 'record_type')
        ordering = ['record_type__sort_order']

    def __str__(self):
        return f"{self.organization.name} - {self.record_type.name} ({'ON' if self.is_enabled else 'OFF'})"


class SafetyRecord(models.Model):
    """완료된 식품안전 기록 (통합 모델)"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FLAGGED', 'Flagged'),
        ('REVIEWED', 'Reviewed'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='safety_records')
    record_type = models.ForeignKey(SafetyRecordType, on_delete=models.PROTECT, related_name='records')

    # When
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)

    # Who
    completed_by = models.ForeignKey(
        UserProfile, on_delete=models.SET_NULL, null=True,
        related_name='safety_records_completed'
    )

    # What (flexible JSON storage)
    data = models.JSONField(default=dict, help_text="Flexible field storage matching record_type.default_fields")

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True, default='')

    # Review workflow
    reviewed_by = models.ForeignKey(
        UserProfile, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='safety_records_reviewed'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, default='')

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-time', '-created_at']
        indexes = [
            models.Index(fields=['organization', 'record_type', 'date']),
            models.Index(fields=['organization', 'date', 'status']),
            models.Index(fields=['completed_by', 'date']),
            models.Index(fields=['status', 'date']),
        ]

    def __str__(self):
        return f"{self.record_type.name} - {self.date} ({self.get_status_display()})"
