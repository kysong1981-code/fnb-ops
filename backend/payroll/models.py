from decimal import Decimal
from django.db import models
from users.models import Organization, UserProfile


class Salary(models.Model):
    """직원 시급 정보"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='salaries')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='salaries')

    # 시급
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, help_text="Hourly rate in NZD")
    overtime_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.5, help_text="Overtime rate multiplier (1.5x = 150%)")

    # 유효 기간
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-effective_from']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['organization', 'is_active']),
        ]

    def __str__(self):
        return f"{self.user.employee_id} - ${self.hourly_rate}/hr (from {self.effective_from})"


class PayPeriod(models.Model):
    """급여 지급 기간"""
    PERIOD_TYPES = (
        ('WEEKLY', 'Weekly'),
        ('FORTNIGHTLY', 'Fortnightly'),
        ('MONTHLY', 'Monthly'),
    )

    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('GENERATED', 'Generated'),
        ('FINALIZED', 'Finalized'),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='pay_periods')

    # 기간
    period_type = models.CharField(max_length=20, choices=PERIOD_TYPES, default='WEEKLY')
    start_date = models.DateField()
    end_date = models.DateField()
    payment_date = models.DateField()

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    is_finalized = models.BooleanField(default=False)  # backward compat

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']
        unique_together = ('organization', 'start_date', 'end_date')
        indexes = [
            models.Index(fields=['organization', 'status']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.start_date} to {self.end_date}"


class PaySlip(models.Model):
    """급여명세서 (NZ Holidays Act 2003 + Employment Relations Act 준수)"""
    pay_period = models.ForeignKey(PayPeriod, on_delete=models.CASCADE, related_name='pay_slips')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='pay_slips')

    # 근무 시간
    regular_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    public_holiday_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0, help_text="Hours worked on public holidays")
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # 급여율
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2)
    overtime_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # Earnings
    regular_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    overtime_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    public_holiday_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Time & half extra (0.5x portion)")
    holiday_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="8% for CASUAL employees")
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Employee deductions (NZ)
    paye_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    kiwisaver = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    student_loan_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    acc_levy = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # kept for backward compat, always 0
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Net
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Employer contributions (not deducted from employee pay)
    kiwisaver_employer = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    esct = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="ESCT on employer KiwiSaver")
    employer_acc = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Tax info snapshot
    tax_code = models.CharField(max_length=10, blank=True, default='M', help_text="Tax code at time of generation")

    # Public holiday tracking
    alternative_holidays_earned = models.IntegerField(default=0, help_text="Alternative holidays (lieu days) earned this period")

    # Metadata
    notes = models.TextField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-pay_period__start_date']
        unique_together = ('pay_period', 'user')
        indexes = [
            models.Index(fields=['user', 'pay_period']),
            models.Index(fields=['is_locked']),
        ]

    def __str__(self):
        return f"{self.user.employee_id} - {self.pay_period}"

    def calculate_salary(self):
        """NZ-compliant salary calculation.
        Uses calculations from payroll.calculations module.
        """
        from .calculations import calculate_annual_paye, calculate_esct

        # 1. Regular & Overtime Pay
        self.regular_pay = self.regular_hours * self.hourly_rate
        self.overtime_pay = self.overtime_hours * self.overtime_rate
        self.total_hours = self.regular_hours + self.overtime_hours

        # 2. Public Holiday Pay (time & half: extra 0.5x portion only)
        # public_holiday_hours already included in regular_hours at 1x rate
        # This is the additional 0.5x bonus
        self.public_holiday_pay = self.public_holiday_hours * self.hourly_rate * Decimal('0.5')

        # 3. Holiday Pay (CASUAL employees only — 8% per NZ Holidays Act)
        base_pay = self.regular_pay + self.overtime_pay + self.public_holiday_pay
        if self.user.work_type == 'CASUAL':
            self.holiday_pay = (base_pay * Decimal('0.08')).quantize(Decimal('0.01'))
        else:
            self.holiday_pay = Decimal('0')

        # 4. Gross salary
        self.gross_salary = base_pay + self.holiday_pay

        # 5. PAYE — annualized calculation with NZ 2025-2026 tax brackets
        periods_map = {'WEEKLY': 52, 'FORTNIGHTLY': 26, 'MONTHLY': 12}
        n = periods_map.get(self.pay_period.period_type, 52)
        annual_income = self.gross_salary * n

        annual_paye = calculate_annual_paye(annual_income)
        self.paye_tax = (annual_paye / n).quantize(Decimal('0.01'))

        # 6. KiwiSaver (employee contribution)
        if self.user.kiwisaver_status == 'ENROLLED':
            rate_str = self.user.kiwisaver_rate or '3%'
            rate = Decimal(rate_str.rstrip('%')) / 100
            self.kiwisaver = (self.gross_salary * rate).quantize(Decimal('0.01'))
        else:
            self.kiwisaver = Decimal('0')

        # 7. Student Loan (12% of annual earnings above $24,128 threshold)
        self.student_loan_deduction = Decimal('0')
        try:
            ir330 = self.user.ir330_declarations.order_by('-created_at').first()
            if ir330 and ir330.has_student_loan:
                threshold = Decimal('24128')
                if annual_income > threshold:
                    annual_sl = (annual_income - threshold) * Decimal('0.12')
                    self.student_loan_deduction = (annual_sl / n).quantize(Decimal('0.01'))
        except Exception:
            pass

        # 8. ACC levy — no employee deduction
        self.acc_levy = Decimal('0')

        # 9. Total deductions = PAYE + KiwiSaver + Student Loan
        self.total_deductions = self.paye_tax + self.kiwisaver + self.student_loan_deduction + self.other_deductions

        # 10. Net salary
        self.net_salary = self.gross_salary - self.total_deductions

        # 11. Employer contributions (not deducted from employee pay)
        if self.user.kiwisaver_status == 'ENROLLED':
            self.kiwisaver_employer = (self.gross_salary * Decimal('0.03')).quantize(Decimal('0.01'))
            # ESCT on employer KiwiSaver contribution
            self.esct = calculate_esct(annual_income, self.kiwisaver_employer)
        else:
            self.kiwisaver_employer = Decimal('0')
            self.esct = Decimal('0')

        # Employer ACC levy (~1%)
        self.employer_acc = (self.gross_salary * Decimal('0.01')).quantize(Decimal('0.01'))

        # Snapshot tax code
        try:
            ir330 = self.user.ir330_declarations.order_by('-created_at').first()
            if ir330:
                self.tax_code = ir330.tax_code
        except Exception:
            pass


class PublicHoliday(models.Model):
    """NZ Public Holidays (11 national + regional anniversaries)"""
    date = models.DateField(help_text="Actual date")
    observed_date = models.DateField(help_text="Observed date (after Mondayisation)")
    name = models.CharField(max_length=100)
    is_national = models.BooleanField(default=True)
    region = models.CharField(
        max_length=30,
        choices=Organization.NZ_REGION_CHOICES,
        null=True, blank=True,
        help_text="Region for anniversary days (null = national)"
    )
    year = models.IntegerField()

    class Meta:
        ordering = ['observed_date']
        unique_together = ('date', 'region', 'year')
        indexes = [
            models.Index(fields=['year', 'observed_date']),
        ]

    def __str__(self):
        region_str = f" ({self.region})" if self.region else ""
        return f"{self.name}{region_str} - {self.observed_date}"


class LeaveBalance(models.Model):
    """Employee leave balances (NZ Holidays Act 2003)"""
    LEAVE_TYPES = (
        ('ANNUAL', 'Annual Leave'),           # 4 weeks after 12 months
        ('SICK', 'Sick Leave'),               # 10 days/year after 6 months
        ('BEREAVEMENT', 'Bereavement Leave'), # 3 days (close family) / 1 day (other)
        ('FAMILY_VIOLENCE', 'Family Violence Leave'),  # 10 days/year after 6 months
        ('ALTERNATIVE', 'Alternative Holiday'),  # Lieu days from public holiday work
    )

    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='leave_balances')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='leave_balances')
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPES)

    # Hours tracking
    balance_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0, help_text="Current available hours")
    accrued_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0, help_text="Total accrued since last reset")
    used_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0, help_text="Total used since last reset")

    # Entitlement tracking
    entitlement_date = models.DateField(null=True, blank=True, help_text="Date when leave entitlement begins (6 months after start)")
    last_anniversary = models.DateField(null=True, blank=True, help_text="Last annual leave anniversary date")

    year = models.IntegerField(help_text="Year for this balance record")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'leave_type', 'year')
        ordering = ['user', 'leave_type']
        indexes = [
            models.Index(fields=['user', 'leave_type', 'year']),
            models.Index(fields=['organization', 'leave_type']),
        ]

    def __str__(self):
        return f"{self.user.employee_id} - {self.leave_type} ({self.balance_hours}h remaining)"


class LeaveRequest(models.Model):
    """Employee leave requests with approval workflow"""
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('DECLINED', 'Declined'),
        ('CANCELLED', 'Cancelled'),
    )

    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='leave_requests')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=20, choices=LeaveBalance.LEAVE_TYPES)

    # Dates
    start_date = models.DateField()
    end_date = models.DateField()
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, help_text="Total leave hours requested")

    # Details
    reason = models.TextField(blank=True)
    attachment = models.FileField(upload_to='leave_attachments/', blank=True, null=True, help_text="Supporting document (e.g. medical certificate)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # Approval
    approved_by = models.ForeignKey(
        UserProfile, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_leave_requests'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.TextField(blank=True)

    # Payment (calculated on approval using OWP vs AWE)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Amount paid (max of OWP, AWE)")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def __str__(self):
        return f"{self.user.employee_id} - {self.leave_type} ({self.start_date} to {self.end_date})"


class PayDayFiling(models.Model):
    """IRD PayDay Filing tracking (NZ employer obligation)
    Must file employment information within 2 working days of each payday.
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('GENERATED', 'Generated'),
        ('FILED', 'Filed'),
    )

    pay_period = models.ForeignKey(PayPeriod, on_delete=models.CASCADE, related_name='payday_filings')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='payday_filings')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    file_data = models.JSONField(null=True, blank=True, help_text="IRD employment information data")

    generated_at = models.DateTimeField(null=True, blank=True)
    filed_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateField(help_text="Filing deadline (payment_date + 2 business days)")

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-due_date']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['due_date']),
        ]

    def __str__(self):
        return f"Filing: {self.pay_period} - {self.status}"
