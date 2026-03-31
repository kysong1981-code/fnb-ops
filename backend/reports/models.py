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
    pos_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # repurposed as number_of_tabs
    other_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # unused
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
        """Total sales excluding GST: (Total - Cash)/1.15 + Cash"""
        from decimal import Decimal
        if self.total_sales_inc_gst == 0:
            return Decimal('0')
        card_excl = (self.total_sales_inc_gst - self.hq_cash) / Decimal('1.15')
        return (card_excl + self.hq_cash).quantize(Decimal('0.01'))

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


class StoreEvaluation(models.Model):
    """Store Evaluation — semi-annual manager performance evaluation"""

    PERIOD_CHOICES = (
        ('H1', 'H1 (Apr-Sep)'),
        ('H2', 'H2 (Oct-Mar)'),
    )

    MANAGER_TYPE_CHOICES = (
        ('NON_EQUITY', 'Non-Equity Manager'),
        ('EQUITY', 'Equity Manager'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='store_evaluations')
    period_type = models.CharField(max_length=2, choices=PERIOD_CHOICES)
    year = models.IntegerField()
    manager_type = models.CharField(max_length=10, choices=MANAGER_TYPE_CHOICES, default='NON_EQUITY')

    # Basic inputs (manual)
    net_profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    account_profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cash_profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    guarantee_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    guarantee_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    incentive_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    incentive_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    incentive_pool = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    equity_share = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    staff_count = models.IntegerField(default=0)
    staff_incentive_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Evaluation targets (manual)
    sales_target = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cogs_target = models.DecimalField(max_digits=5, decimal_places=4, default=0)
    wage_target = models.DecimalField(max_digits=5, decimal_places=4, default=0)

    # Evaluation achievements (can be auto-filled from SkyReport or manual)
    sales_achievement = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cogs_achievement = models.DecimalField(max_digits=5, decimal_places=4, default=0)
    wage_achievement = models.DecimalField(max_digits=5, decimal_places=4, default=0)
    service_rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    hygiene_months = models.IntegerField(default=0)
    leadership_score = models.IntegerField(default=0)

    # Auto-calculated scores
    sales_score = models.IntegerField(default=0)
    cogs_score = models.IntegerField(default=0)
    wage_score = models.IntegerField(default=0)
    service_score = models.IntegerField(default=0)
    hygiene_score = models.IntegerField(default=0)
    leadership_score_points = models.IntegerField(default=0)
    total_score = models.IntegerField(default=0)
    payout_ratio = models.DecimalField(max_digits=5, decimal_places=4, default=0)

    # Lock
    is_locked = models.BooleanField(default=False)

    # Meta
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='store_evaluations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', '-period_type']
        unique_together = ['organization', 'year', 'period_type']
        indexes = [
            models.Index(fields=['organization', 'year', 'period_type']),
        ]

    def __str__(self):
        return f"Evaluation - {self.organization} {self.year} {self.get_period_type_display()}"


class ProfitShare(models.Model):
    """Store-level profit share summary per semi-annual period"""

    PERIOD_CHOICES = (
        ('H1', 'H1 (Apr-Sep)'),
        ('H2', 'H2 (Oct-Mar)'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='profit_shares')
    year = models.IntegerField()
    period_type = models.CharField(max_length=2, choices=PERIOD_CHOICES)

    # Revenue
    account_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    account_25 = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Tax
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Bank
    bank_account = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bank_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_bank = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Net Profit
    net_profit_account = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_profit_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Incentive
    incentive_account = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    incentive_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    incentive_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    incentive_pct = models.DecimalField(max_digits=5, decimal_places=4, default=0)

    # Evaluation Score (pulled from StoreEvaluation)
    evaluation_score = models.IntegerField(default=0)

    # Lock & Notes
    is_locked = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default='')

    # Meta
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='profit_shares')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', '-period_type']
        unique_together = ['organization', 'year', 'period_type']
        indexes = [
            models.Index(fields=['organization', 'year', 'period_type']),
        ]

    def __str__(self):
        return f"ProfitShare - {self.organization} {self.year} {self.get_period_type_display()}"

    def calculate_totals(self):
        """Recalculate auto-computed totals."""
        from decimal import Decimal
        self.total_revenue = self.account_revenue + self.account_25
        self.total_bank = self.bank_account + self.bank_cash
        self.incentive_total = self.incentive_account + self.incentive_cash
        # Auto-calc incentive from pct if incentive fields are 0 but pct is set
        if self.incentive_pct > 0:
            if self.incentive_account == 0 and self.net_profit_account > 0:
                self.incentive_account = (self.net_profit_account * self.incentive_pct).quantize(Decimal('0.01'))
            if self.incentive_cash == 0 and self.net_profit_cash > 0:
                self.incentive_cash = (self.net_profit_cash * self.incentive_pct).quantize(Decimal('0.01'))
            self.incentive_total = self.incentive_account + self.incentive_cash


class PartnerShare(models.Model):
    """Individual partner distribution within a ProfitShare"""

    PARTNER_TYPE_CHOICES = (
        ('EQUITY', 'Equity Partner'),
        ('NON_EQUITY', 'Non-Equity Partner'),
        ('OWNER', 'Owner'),
    )

    profit_share = models.ForeignKey(ProfitShare, on_delete=models.CASCADE, related_name='partners')
    name = models.CharField(max_length=100)
    partner_type = models.CharField(max_length=10, choices=PARTNER_TYPE_CHOICES, default='EQUITY')

    # Percentages
    incentive_pct = models.DecimalField(max_digits=5, decimal_places=4, default=0)
    equity_pct = models.DecimalField(max_digits=5, decimal_places=4, default=0)

    # Calculated amounts
    incentive_account = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    incentive_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bank_account = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bank_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_account = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Fixed amount (bypasses percentage calculation)
    fixed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Notes & order
    notes = models.TextField(blank=True, default='')
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.name} ({self.get_partner_type_display()}) - {self.profit_share}"

    def calculate_amounts(self):
        """Recalculate amounts from parent ProfitShare percentages.

        If parent has an evaluation_score > 0, incentive amounts are scaled
        by score_percentage (e.g. score 90 => 0.9).
        """
        from decimal import Decimal
        parent = self.profit_share

        # Score percentage: if evaluation_score is set, scale incentives
        score_pct = Decimal('1')
        if parent.evaluation_score and parent.evaluation_score > 0:
            score_pct = Decimal(str(parent.evaluation_score)) / Decimal('100')

        # Actual incentive after score adjustment
        actual_incentive_account = (parent.incentive_account * score_pct).quantize(Decimal('0.01'))
        actual_incentive_cash = (parent.incentive_cash * score_pct).quantize(Decimal('0.01'))

        if self.fixed_amount > 0:
            # Fixed amount partner: split evenly between account and cash
            self.incentive_account = Decimal('0')
            self.incentive_cash = Decimal('0')
            self.bank_account = Decimal('0')
            self.bank_cash = Decimal('0')
            self.total_account = (self.fixed_amount / 2).quantize(Decimal('0.01'))
            self.total_cash = self.fixed_amount - self.total_account
            self.total = self.fixed_amount
        elif self.partner_type == 'OWNER':
            # Owner gets remainder after all other partners
            other_partners = parent.partners.exclude(id=self.id)
            total_other_incentive_account = sum(p.incentive_account for p in other_partners)
            total_other_incentive_cash = sum(p.incentive_cash for p in other_partners)
            total_other_bank_account = sum(p.bank_account for p in other_partners)
            total_other_bank_cash = sum(p.bank_cash for p in other_partners)

            self.incentive_account = actual_incentive_account - total_other_incentive_account
            self.incentive_cash = actual_incentive_cash - total_other_incentive_cash
            self.bank_account = parent.net_profit_account - actual_incentive_account - total_other_bank_account
            self.bank_cash = parent.net_profit_cash - actual_incentive_cash - total_other_bank_cash
            self.total_account = self.incentive_account + self.bank_account
            self.total_cash = self.incentive_cash + self.bank_cash
            self.total = self.total_account + self.total_cash
        else:
            # Percentage-based partner
            self.incentive_account = (actual_incentive_account * self.incentive_pct).quantize(Decimal('0.01'))
            self.incentive_cash = (actual_incentive_cash * self.incentive_pct).quantize(Decimal('0.01'))
            # Equity is based on net profit MINUS actual incentive (after score)
            distributable_account = parent.net_profit_account - actual_incentive_account
            distributable_cash = parent.net_profit_cash - actual_incentive_cash
            self.bank_account = (distributable_account * self.equity_pct).quantize(Decimal('0.01'))
            self.bank_cash = (distributable_cash * self.equity_pct).quantize(Decimal('0.01'))
            self.total_account = self.incentive_account + self.bank_account
            self.total_cash = self.incentive_cash + self.bank_cash
            self.total = self.total_account + self.total_cash
