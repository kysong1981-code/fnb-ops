import uuid
from django.db import models
from django.utils import timezone
from datetime import timedelta
from users.models import Organization, UserProfile, ROLE_CHOICES, WORK_TYPE_CHOICES


class Onboarding(models.Model):
    """직원 온보딩 프로세스"""
    STATUS_CHOICES = (
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('ON_HOLD', 'On Hold'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='onboardings')
    employee = models.OneToOneField(UserProfile, on_delete=models.CASCADE, related_name='onboarding')

    # 상태
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IN_PROGRESS')

    # 진행률
    completed_percentage = models.IntegerField(default=0)

    # 메모
    notes = models.TextField(null=True, blank=True)

    # 감독자
    assigned_to = models.ForeignKey(UserProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='onboardings_assigned')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['employee']),
        ]

    def __str__(self):
        return f"Onboarding - {self.employee.user.get_full_name()}"

    @property
    def all_tasks_completed(self):
        """모든 온보딩 작업 완료 여부"""
        total_tasks = self.tasks.count()
        completed_tasks = self.tasks.filter(is_completed=True).count()
        return total_tasks > 0 and total_tasks == completed_tasks


class OnboardingTask(models.Model):
    """온보딩 체크리스트 항목"""
    STEP_TYPE_CHOICES = (
        ('PERSONAL_INFO', 'Personal Information'),
        ('BANK_ACCOUNT', 'Bank Account'),
        ('IR330', 'IR330 Tax Declaration'),
        ('DOCUMENT_SIGN', 'Document Signing'),
        ('FILE_UPLOAD', 'File Upload'),
        ('TRAINING', 'Training'),
        ('CUSTOM', 'Custom Task'),
    )

    onboarding = models.ForeignKey(Onboarding, on_delete=models.CASCADE, related_name='tasks')

    # 작업 정보
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=0)

    # Step type for structured onboarding flow
    step_type = models.CharField(max_length=20, choices=STEP_TYPE_CHOICES, default='CUSTOM')
    related_document = models.ForeignKey('EmployeeDocument', null=True, blank=True, on_delete=models.SET_NULL, related_name='onboarding_tasks')
    related_training = models.ForeignKey('TrainingModule', null=True, blank=True, on_delete=models.SET_NULL, related_name='onboarding_tasks')
    upload_label = models.CharField(max_length=100, blank=True, default='')
    uploaded_file = models.FileField(upload_to='onboarding_uploads/%Y/%m/', null=True, blank=True)

    # 상태
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    # 담당자
    assigned_to = models.ForeignKey(UserProfile, null=True, blank=True, on_delete=models.SET_NULL)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['onboarding', 'is_completed']),
        ]

    def __str__(self):
        return f"{self.onboarding.employee.user.get_full_name()} - {self.title}"


class EmployeeDocument(models.Model):
    """직원 문서 (계약서, JD, Offer 등)"""
    DOCUMENT_TYPE_CHOICES = (
        ('CONTRACT', 'Contract'),
        ('JOB_DESCRIPTION', 'Job Description'),
        ('JOB_OFFER', 'Job Offer'),
        ('OTHER', 'Other'),
    )

    onboarding = models.ForeignKey(Onboarding, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    employee = models.ForeignKey(UserProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='employee_documents')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='employee_documents')

    # 문서 타입
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    title = models.CharField(max_length=255)

    # 파일
    file = models.FileField(upload_to='employee_documents/%Y/%m/%d/')
    pdf_file = models.FileField(upload_to='employee_documents/pdf/%Y/%m/', null=True, blank=True)

    # 서명 영역 좌표 (DOCX 마커 [[SIGNATURE]] 등에서 자동 감지)
    sign_zones = models.JSONField(default=list, blank=True)

    # 서명 정보
    is_signed = models.BooleanField(default=False)
    signed_at = models.DateTimeField(null=True, blank=True)
    signed_by = models.ForeignKey(UserProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='signed_documents')
    signature = models.ImageField(upload_to='signatures/%Y/%m/', null=True, blank=True)

    # 메타데이터
    uploaded_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='uploaded_documents')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # 다운로드 기록
    download_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['onboarding', 'document_type']),
            models.Index(fields=['is_signed']),
        ]

    def __str__(self):
        return f"{self.onboarding.employee.user.get_full_name()} - {self.title}"


class ShiftTemplate(models.Model):
    """시프트 템플릿 (Morning, Hot Meal, Closing 등)"""
    COLOR_CHOICES = (
        ('blue', 'Blue'),
        ('emerald', 'Green'),
        ('amber', 'Amber'),
        ('rose', 'Rose'),
        ('purple', 'Purple'),
        ('cyan', 'Cyan'),
        ('indigo', 'Indigo'),
        ('pink', 'Pink'),
        ('orange', 'Orange'),
        ('red', 'Red'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='shift_templates')
    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.IntegerField(default=30, help_text="Break duration in minutes")
    color = models.CharField(max_length=20, choices=COLOR_CHOICES, default='blue')
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']
        unique_together = ('organization', 'name')

    def __str__(self):
        return f"{self.name} ({self.start_time}-{self.end_time})"


class Roster(models.Model):
    """근무 스케줄"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='rosters')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='rosters')

    # 스케줄 정보
    date = models.DateField()
    shift_start = models.TimeField()
    shift_end = models.TimeField()
    shift_name = models.CharField(max_length=100, null=True, blank=True)
    shift_color = models.CharField(max_length=20, null=True, blank=True)
    shift_template = models.ForeignKey(ShiftTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='rosters')
    break_minutes = models.IntegerField(default=30, help_text="Scheduled break in minutes")
    is_confirmed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        unique_together = ('user', 'date')
        indexes = [
            models.Index(fields=['organization', 'date']),
            models.Index(fields=['user', 'date']),
        ]

    def __str__(self):
        return f"{self.user.employee_id} - {self.date} ({self.shift_start}-{self.shift_end})"

    @property
    def hours(self):
        """근무 시간 계산 (break 제외)"""
        from datetime import datetime, timedelta
        start = datetime.combine(self.date, self.shift_start)
        end = datetime.combine(self.date, self.shift_end)
        if end < start:
            end += timedelta(days=1)
        total = (end - start).total_seconds() / 3600
        return total - (self.break_minutes / 60)


class Timesheet(models.Model):
    """타임시트 (출퇴근 기록)"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='timesheets')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='timesheets')

    # Work record
    date = models.DateField()
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)

    # Break tracking
    break_start = models.DateTimeField(null=True, blank=True)
    break_end = models.DateTimeField(null=True, blank=True)
    total_break_minutes = models.IntegerField(default=0)

    # Overtime
    is_overtime = models.BooleanField(default=False)
    overtime_reason = models.TextField(null=True, blank=True)
    overtime_approved = models.BooleanField(default=False)
    overtime_approved_by = models.ForeignKey(
        UserProfile, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_overtimes'
    )

    # Status
    is_approved = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        unique_together = ('user', 'date')
        indexes = [
            models.Index(fields=['organization', 'date']),
            models.Index(fields=['user', 'date']),
        ]

    def __str__(self):
        return f"{self.user.employee_id} - {self.date}"

    @property
    def worked_hours(self):
        """Net worked hours (total - breaks)"""
        if self.check_in and self.check_out:
            total = (self.check_out - self.check_in).total_seconds() / 3600
            break_hours = self.total_break_minutes / 60
            return total - break_hours
        return 0

    @property
    def scheduled_hours(self):
        """Get scheduled hours from roster for overtime calculation"""
        from hr.models import Roster
        roster = Roster.objects.filter(user=self.user, date=self.date).first()
        if roster:
            return roster.hours
        return 0


class Task(models.Model):
    """일반 업무 할당"""
    PRIORITY_CHOICES = (
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    assigned_to = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='assigned_tasks')
    assigned_by = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='created_tasks')

    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    due_date = models.DateField()
    due_time = models.TimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['assigned_to', 'status']),
        ]

    def __str__(self):
        return f"{self.title} → {self.assigned_to.user.get_full_name()}"


class EmployeeInvite(models.Model):
    """직원 초대"""
    INVITE_STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('EXPIRED', 'Expired'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invites')
    invite_code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    email = models.EmailField()
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, default='')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='EMPLOYEE')
    job_title = models.CharField(max_length=30)
    work_type = models.CharField(max_length=20, choices=WORK_TYPE_CHOICES)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2)

    # IEA (Individual Employment Agreement) fields
    commencement_date = models.DateField(null=True, blank=True)
    work_location = models.CharField(max_length=255, blank=True, default='')
    min_hours = models.PositiveIntegerField(null=True, blank=True)
    max_hours = models.PositiveIntegerField(null=True, blank=True)
    reporting_to = models.CharField(max_length=100, blank=True, default='Director/Management')

    status = models.CharField(max_length=20, choices=INVITE_STATUS_CHOICES, default='PENDING')
    invited_by = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='sent_invites')
    accepted_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='accepted_invite')

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['invite_code']),
        ]

    def __str__(self):
        return f"Invite: {self.first_name} {self.last_name} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at and self.status == 'PENDING'


class DocumentTemplate(models.Model):
    """문서 템플릿 (Contract, Job Offer, Job Description)"""
    TEMPLATE_TYPE_CHOICES = (
        ('CONTRACT', 'Contract'),
        ('JOB_OFFER', 'Job Offer'),
        ('JOB_DESCRIPTION', 'Job Description'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='document_templates')
    document_type = models.CharField(max_length=50, choices=TEMPLATE_TYPE_CHOICES)
    work_type = models.CharField(max_length=20, choices=WORK_TYPE_CHOICES, null=True, blank=True)
    job_title = models.CharField(max_length=30, null=True, blank=True)
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='document_templates/%Y/%m/')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['document_type', '-created_at']
        indexes = [
            models.Index(fields=['organization', 'document_type']),
        ]

    def __str__(self):
        return f"{self.get_document_type_display()} - {self.title}"


class IR330Declaration(models.Model):
    """NZ IR330 Tax Declaration"""
    TAX_CODE_CHOICES = (
        ('M', 'M - Primary employment'),
        ('ME', 'ME - Primary + student loan'),
        ('SB', 'SB - Secondary < $14k'),
        ('S', 'S - Secondary $14k-$48k'),
        ('SH', 'SH - Secondary $48k-$70k'),
        ('ST', 'ST - Secondary $70k-$180k'),
        ('SA', 'SA - Secondary > $180k'),
        ('CAE', 'CAE - Casual agricultural'),
        ('EDW', 'EDW - Election day worker'),
        ('ND', 'ND - No declaration'),
    )

    employee = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='ir330_declarations')
    onboarding = models.ForeignKey(Onboarding, on_delete=models.SET_NULL, null=True, blank=True, related_name='ir330_declaration')
    ird_number = models.CharField(max_length=20, help_text='NZ IRD number')
    tax_code = models.CharField(max_length=10, choices=TAX_CODE_CHOICES)
    is_nz_resident = models.BooleanField(default=True)
    has_student_loan = models.BooleanField(default=False)
    signature = models.ImageField(upload_to='signatures/ir330/%Y/%m/', null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"IR330 - {self.employee.user.get_full_name()} ({self.tax_code})"


class TrainingModule(models.Model):
    """온보딩 교육 모듈"""
    MODULE_TYPE_CHOICES = (
        ('SAFETY', 'Safety Training'),
        ('FCP', 'FCP Training'),
        ('HAZARD', 'Hazard Training'),
        ('CUSTOM', 'Custom'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='training_modules')
    module_type = models.CharField(max_length=20, choices=MODULE_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    file = models.FileField(upload_to='training_materials/%Y/%m/', null=True, blank=True)
    video_url = models.URLField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'module_type']
        indexes = [
            models.Index(fields=['organization', 'module_type']),
        ]

    def __str__(self):
        return f"{self.get_module_type_display()} - {self.title}"


class Inquiry(models.Model):
    """직원 → 매니저 문의"""
    CATEGORY_CHOICES = (
        ('GENERAL', 'General'),
        ('PAY', 'Pay & Payslip'),
        ('SCHEDULE', 'Schedule & Roster'),
        ('LEAVE', 'Leave'),
        ('OTHER', 'Other'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('REPLIED', 'Replied'),
        ('CLOSED', 'Closed'),
    )

    employee = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='inquiries')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='inquiries')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='GENERAL')
    subject = models.CharField(max_length=200)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reply = models.TextField(blank=True, default='')
    replied_by = models.ForeignKey(UserProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='replied_inquiries')
    replied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['employee']),
        ]

    def __str__(self):
        return f"{self.employee.user.get_full_name()} - {self.subject}"
