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

# Employment Status
EMPLOYMENT_STATUS_CHOICES = (
    ('ACTIVE', 'Active'),
    ('LEAVE', 'On Leave'),
    ('TERMINATED', 'Terminated'),
    ('RESIGNED', 'Resigned'),
)

class Organization(models.Model):
    """조직 구조: 본사, 지역, 매장"""

    LEVEL_CHOICES = (
        ('HQ', 'Headquarters'),
        ('REGION', 'Region'),
        ('STORE', 'Store'),
    )

    name = models.CharField(max_length=255)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')

    # Store specific fields
    address = models.TextField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)

    # Operating hours
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)

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

    # Work type
    work_type = models.CharField(max_length=20, choices=[
        ('FULL_TIME', 'Full Time'),
        ('PART_TIME', 'Part Time'),
        ('CASUAL', 'Casual'),
    ], default='FULL_TIME')

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
