from django.db import models
from users.models import Organization, UserProfile


class Report(models.Model):
    """리포트 템플릿 및 설정"""
    REPORT_TYPE_CHOICES = (
        ('DAILY_CLOSING', 'Daily Closing Report'),
        ('SALES_ANALYSIS', 'Sales Analysis'),
        ('STORE_COMPARISON', 'Store Comparison'),
        ('PAYROLL', 'Payroll Report'),
        ('SAFETY', 'Safety Report'),
        ('HR', 'HR Report'),
        ('CUSTOM', 'Custom Report'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='reports')
    report_type = models.CharField(max_length=50, choices=REPORT_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    # 리포트 설정
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='reports_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'report_type']),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_report_type_display()})"


class GeneratedReport(models.Model):
    """생성된 리포트 기록"""
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name='generated_reports')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)

    # 리포트 데이터
    report_date = models.DateField()
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)

    # 생성 정보
    generated_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    # PDF 파일
    pdf_file = models.FileField(upload_to='reports/%Y/%m/%d/', null=True, blank=True)

    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['organization', 'report_date']),
            models.Index(fields=['report', 'period_start', 'period_end']),
        ]

    def __str__(self):
        return f"{self.report.title} - {self.report_date}"
