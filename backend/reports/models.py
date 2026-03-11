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


class SkyReport(models.Model):
    """Monthly Sky Report — financial summary per store per month"""
    MONTH_CHOICES = [
        (1, 'January'), (2, 'February'), (3, 'March'), (4, 'April'),
        (5, 'May'), (6, 'June'), (7, 'July'), (8, 'August'),
        (9, 'September'), (10, 'October'), (11, 'November'), (12, 'December'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='sky_reports')
    year = models.IntegerField()
    month = models.IntegerField(choices=MONTH_CHOICES)

    # Main Financial Data
    total_sales_inc_gst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    hq_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    pos_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cogs = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    operating_expenses = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    wages = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sales_per_hour = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    opening_sales_per_hour = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tab_allowance_sales = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payable_gst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sub_gst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    operating_profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Input Fields (from external systems: Xero / Garage)
    total_sales_garage = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    hq_cash_garage = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cogs_xero = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_expense_xero = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    labour_xero = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sub_contractor_xero = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    number_of_days = models.IntegerField(default=0)
    number_of_payruns = models.IntegerField(default=0)

    # Goals (next month targets)
    sales_goal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cogs_goal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    wage_goal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    review_rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    review_goal = models.DecimalField(max_digits=3, decimal_places=1, default=0)

    # Hygiene
    hygiene_grade = models.CharField(max_length=5, default='A')

    # Notes
    sales_notes = models.TextField(blank=True, default='')
    cogs_notes = models.TextField(blank=True, default='')
    wage_notes = models.TextField(blank=True, default='')
    next_month_notes = models.TextField(blank=True, default='')

    # Meta
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='sky_reports')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', '-month']
        unique_together = ['organization', 'year', 'month']
        indexes = [
            models.Index(fields=['organization', 'year', 'month']),
        ]

    def __str__(self):
        return f"Sky Report - {self.get_month_display()} {self.year}"

    @property
    def excl_gst_sales(self):
        """Total sales excluding GST (GST = 15% in NZ)"""
        from decimal import Decimal
        return (self.total_sales_inc_gst / Decimal('1.15')).quantize(Decimal('0.01'))

    @property
    def cogs_ratio(self):
        if self.total_sales_inc_gst == 0:
            return 0
        from decimal import Decimal
        return (self.cogs / self.total_sales_inc_gst * 100).quantize(Decimal('0.1'))

    @property
    def wage_ratio(self):
        if self.total_sales_inc_gst == 0:
            return 0
        from decimal import Decimal
        return (self.wages / self.total_sales_inc_gst * 100).quantize(Decimal('0.1'))
