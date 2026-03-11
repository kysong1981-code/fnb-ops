from django.db import models
from django.contrib.auth.models import User
from django.core.validators import URLValidator
from datetime import datetime, timedelta

# Role Choices
ROLE_CHOICES = (
    ('EMPLOYEE', 'Employee'),
    ('MANAGER', 'Manager'),
    ('SENIOR_MANAGER', 'Senior Manager'),
    ('REGIONAL_MANAGER', 'Regional Manager'),
    ('HQ', 'HQ / Head Office'),
    ('CEO', 'CEO'),
)

# Work Type Choices
WORK_TYPE_CHOICES = (
    ('FULL_TIME', 'Full Time'),
    ('PART_TIME', 'Part Time'),
    ('CASUAL', 'Casual'),
    ('SALARY', 'Salary'),
    ('VISA_FULL_TIME', 'Visa Full Time'),
)

# Job Title Choices
JOB_TITLE_CHOICES = (
    ('STORE_MANAGER', 'Store Manager'),
    ('ASSISTANT_MANAGER', 'Assistant Manager'),
    ('SUPERVISOR', 'Supervisor'),
    ('BARISTA', 'Barista'),
    ('HEAD_CHEF', 'Head Chef'),
    ('CHEF', 'Chef'),
    ('COOK', 'Cook'),
    ('KITCHEN_HAND', 'Kitchen Hand'),
    ('SERVER', 'Server'),
    ('CASHIER', 'Cashier'),
    ('ALL_ROUNDER', 'All Rounder'),
    ('CLEANER', 'Cleaner'),
    ('OTHER', 'Other'),
)

# Employment Status
EMPLOYMENT_STATUS_CHOICES = (
    ('ACTIVE', 'Active'),
    ('LEAVE', 'On Leave'),
    ('TERMINATED', 'Terminated'),
    ('RESIGNED', 'Resigned'),
)

DEFAULT_MODULES = [
    'CLOSING', 'CASHUP', 'REPORTS', 'SALES', 'ROSTER',
    'TIMESHEET', 'HR', 'PAYROLL', 'TASKS', 'SAFETY',
    'DOCUMENTS', 'INQUIRIES',
]


def get_default_modules():
    return list(DEFAULT_MODULES)


class Organization(models.Model):
    """조직 구조: 본사, 지역, 매장"""

    LEVEL_CHOICES = (
        ('HQ', 'Headquarters'),
        ('REGION', 'Region'),
        ('STORE', 'Store'),
    )

    NZ_REGION_CHOICES = (
        ('AUCKLAND', 'Auckland'),
        ('WELLINGTON', 'Wellington'),
        ('CANTERBURY', 'Canterbury'),
        ('OTAGO', 'Otago'),
        ('WAIKATO', 'Waikato'),
        ('BAY_OF_PLENTY', 'Bay of Plenty'),
        ('HAWKES_BAY', "Hawke's Bay"),
        ('TARANAKI', 'Taranaki'),
        ('MANAWATU_WHANGANUI', 'Manawatū-Whanganui'),
        ('NELSON', 'Nelson'),
        ('MARLBOROUGH', 'Marlborough'),
        ('WEST_COAST', 'West Coast'),
        ('SOUTHLAND', 'Southland'),
        ('NORTHLAND', 'Northland'),
        ('GISBORNE', 'Gisborne'),
        ('CHATHAM_ISLANDS', 'Chatham Islands'),
    )

    name = models.CharField(max_length=255)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')

    # Store specific fields
    address = models.TextField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    region = models.CharField(max_length=30, choices=NZ_REGION_CHOICES, null=True, blank=True, help_text="NZ 지역 (Anniversary Day 적용)")
    ird_number = models.CharField(max_length=20, null=True, blank=True, help_text="IRD 번호")
    logo = models.ImageField(upload_to='organization/logos/', null=True, blank=True)

    # Operating hours
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)

    # Store settings
    hr_cash_enabled = models.BooleanField(default=True, help_text="HR 현금 입력 활성화 여부")

    # Feature module toggles
    enabled_modules = models.JSONField(default=get_default_modules, help_text="활성화된 모듈 목록")

    # Otherwise Working 룰 (NZ 공휴일 적용 기준)
    otherwise_working_weeks = models.PositiveIntegerField(default=8, help_text="몇 주 기간 확인")
    otherwise_working_threshold = models.PositiveIntegerField(default=7, help_text="그 중 몇 번 근무해야 적용")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['level', 'name']

    def __str__(self):
        return f"{self.name} ({self.level})"


class UserProfile(models.Model):
    """사용자 프로필"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    employee_id = models.CharField(max_length=50, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    # Organization assignment
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True)
    manager = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='subordinates')

    # Employment details
    date_of_joining = models.DateField()
    phone = models.CharField(max_length=20, null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)

    # Employment status
    employment_status = models.CharField(max_length=20, choices=EMPLOYMENT_STATUS_CHOICES, default='ACTIVE')

    # New Zealand specific
    tax_file_number = models.CharField(max_length=20, null=True, blank=True)  # IRD number
    kiwisaver_status = models.CharField(max_length=20, choices=[
        ('NOT_ENROLLED', 'Not Enrolled'),
        ('ENROLLED', 'Enrolled'),
        ('OPTED_OUT', 'Opted Out'),
    ], default='NOT_ENROLLED')
    kiwisaver_rate = models.CharField(max_length=10, choices=[
        ('3%', '3%'),
        ('4%', '4%'),
        ('6%', '6%'),
        ('8%', '8%'),
        ('10%', '10%'),
    ], default='3%', null=True, blank=True)

    # Bank account (NZ format: XX-XXXX-XXXXXXX-XXX)
    bank_account = models.CharField(max_length=30, null=True, blank=True, help_text='NZ bank account number')

    # Work type
    work_type = models.CharField(max_length=20, choices=WORK_TYPE_CHOICES, default='FULL_TIME')

    # Job title
    job_title = models.CharField(max_length=30, choices=JOB_TITLE_CHOICES, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.employee_id})"

    def get_role_display(self):
        """사용자의 역할 반환"""
        return dict(ROLE_CHOICES).get(self.role, self.role)


class Permission(models.Model):
    """권한 정의"""
    RESOURCE_CHOICES = (
        ('SALES', 'Sales Management'),
        ('CLOSING', 'Daily Closing'),
        ('REPORTS', 'Reports'),
        ('HR', 'Human Resources'),
        ('PAYROLL', 'Payroll'),
        ('SAFETY', 'Food Safety'),
        ('DOCUMENTS', 'Documents Library'),
        ('USERS', 'User Management'),
    )

    ACTION_CHOICES = (
        ('VIEW', 'View'),
        ('CREATE', 'Create'),
        ('EDIT', 'Edit'),
        ('DELETE', 'Delete'),
        ('APPROVE', 'Approve'),
        ('EXPORT', 'Export'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    resource = models.CharField(max_length=20, choices=RESOURCE_CHOICES)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('role', 'resource', 'action')
        ordering = ['role', 'resource', 'action']

    def __str__(self):
        return f"{self.role} - {self.resource} - {self.action}"


INTEGRATION_SERVICE_CHOICES = (
    ('GOMENU', 'GoMenu POS'),
    ('LIGHTSPEED', 'Lightspeed POS'),
    ('XERO', 'Xero Accounting'),
)


class Integration(models.Model):
    """Third-party service integration settings per organization"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='integrations')
    service = models.CharField(max_length=20, choices=INTEGRATION_SERVICE_CHOICES)
    is_connected = models.BooleanField(default=False)

    # Credentials
    api_key = models.CharField(max_length=500, null=True, blank=True)
    api_secret = models.CharField(max_length=500, null=True, blank=True)
    access_token = models.TextField(null=True, blank=True)
    refresh_token = models.TextField(null=True, blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)

    # Extra config (webhook URLs, sync settings, etc.)
    config = models.JSONField(default=dict, blank=True)

    # Audit
    connected_by = models.ForeignKey('UserProfile', on_delete=models.SET_NULL, null=True, blank=True)
    connected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['organization', 'service']
        ordering = ['service']

    def __str__(self):
        status = 'Connected' if self.is_connected else 'Disconnected'
        return f"{self.organization.name} - {self.get_service_display()} ({status})"


class AuditLog(models.Model):
    """감사 로그"""
    user = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=255)
    resource = models.CharField(max_length=50)
    resource_id = models.IntegerField(null=True, blank=True)

    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['resource', 'resource_id']),
        ]

    def __str__(self):
        return f"{self.user} - {self.action} - {self.resource}"


class StoreApplication(models.Model):
    """Store opening application from prospective store owners"""
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    # Applicant info
    applicant_name = models.CharField(max_length=255)
    applicant_email = models.EmailField()
    applicant_phone = models.CharField(max_length=20, blank=True, default='')

    # Store info
    store_name = models.CharField(max_length=255)
    store_address = models.TextField(blank=True, default='')
    store_phone = models.CharField(max_length=20, blank=True, default='')

    # Desired feature modules
    desired_modules = models.JSONField(default=get_default_modules)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    admin_notes = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.store_name} - {self.applicant_name} ({self.status})"
