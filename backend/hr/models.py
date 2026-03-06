from django.db import models
from users.models import Organization, UserProfile


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
    onboarding = models.ForeignKey(Onboarding, on_delete=models.CASCADE, related_name='tasks')

    # 작업 정보
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=0)

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

    onboarding = models.ForeignKey(Onboarding, on_delete=models.CASCADE, related_name='documents')

    # 문서 타입
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    title = models.CharField(max_length=255)

    # 파일
    file = models.FileField(upload_to='employee_documents/%Y/%m/%d/')

    # 서명 정보
    is_signed = models.BooleanField(default=False)
    signed_at = models.DateTimeField(null=True, blank=True)
    signed_by = models.ForeignKey(UserProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='signed_documents')

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


class Roster(models.Model):
    """근무 스케줄"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='rosters')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='rosters')

    # 스케줄 정보
    date = models.DateField()
    shift_start = models.TimeField()
    shift_end = models.TimeField()
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
        """근무 시간 계산"""
        from datetime import datetime, timedelta
        start = datetime.combine(self.date, self.shift_start)
        end = datetime.combine(self.date, self.shift_end)
        if end < start:
            end += timedelta(days=1)
        return (end - start).total_seconds() / 3600


class Timesheet(models.Model):
    """타임시트 (출퇴근 기록)"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='timesheets')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='timesheets')

    # 근무 기록
    date = models.DateField()
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)

    # 상태
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
        """실제 근무 시간"""
        if self.check_in and self.check_out:
            return (self.check_out - self.check_in).total_seconds() / 3600
        return 0
