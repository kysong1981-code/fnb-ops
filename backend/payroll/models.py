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

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='pay_periods')

    # 기간
    period_type = models.CharField(max_length=20, choices=PERIOD_TYPES, default='WEEKLY')
    start_date = models.DateField()
    end_date = models.DateField()
    payment_date = models.DateField()

    is_finalized = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']
        unique_together = ('organization', 'start_date', 'end_date')
        indexes = [
            models.Index(fields=['organization', 'is_finalized']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.start_date} to {self.end_date}"


class PaySlip(models.Model):
    """급여명세서 (뉴질랜드 법 준수)"""
    pay_period = models.ForeignKey(PayPeriod, on_delete=models.CASCADE, related_name='pay_slips')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='pay_slips')

    # 근무 시간
    regular_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # 급여 계산
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2)
    overtime_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # 고용주와 직원 컨트리뷰션
    regular_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    overtime_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # 공제 (뉴질랜드)
    paye_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # 소득세
    kiwisaver = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # Kiwisaver (직원)
    acc_levy = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # ACC 산재보험

    # 기타 공제
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # 순급여
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # 고용주 컨트리뷰션 (급여에 포함 안됨)
    kiwisaver_employer = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # 고용주 기여금
    employer_acc = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # 고용주 ACC 기여금

    # 메타데이터
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
        """급여 자동 계산"""
        # Regular pay
        self.regular_pay = self.regular_hours * self.hourly_rate
        # Overtime pay (default 1.5x)
        self.overtime_pay = self.overtime_hours * self.overtime_rate
        # Gross salary
        self.gross_salary = self.regular_pay + self.overtime_pay
        # Total hours
        self.total_hours = self.regular_hours + self.overtime_hours

        # Calculate PAYE tax (simplified NZ tax brackets 2024)
        # This is a basic calculation and should be adjusted based on current tax tables
        if self.gross_salary <= 11000:
            self.paye_tax = 0
        elif self.gross_salary <= 47000:
            self.paye_tax = (self.gross_salary - 11000) * 0.105
        elif self.gross_salary <= 70000:
            self.paye_tax = 3780 + (self.gross_salary - 47000) * 0.175
        elif self.gross_salary <= 180000:
            self.paye_tax = 7795 + (self.gross_salary - 70000) * 0.30
        else:
            self.paye_tax = 40795 + (self.gross_salary - 180000) * 0.33

        # Calculate Kiwisaver (employee contribution)
        if self.user.kiwisaver_status == 'ENROLLED':
            rate = float(self.user.kiwisaver_rate.rstrip('%')) / 100
            self.kiwisaver = self.gross_salary * rate
        else:
            self.kiwisaver = 0

        # ACC Levy (employee portion - 2024 rate is approximately $0.62 per $100 of wages)
        self.acc_levy = self.gross_salary * 0.0062

        # Total deductions
        self.total_deductions = self.paye_tax + self.kiwisaver + self.acc_levy + self.other_deductions

        # Net salary
        self.net_salary = self.gross_salary - self.total_deductions

        # Employer contributions (for reference only, not deducted from employee pay)
        if self.user.kiwisaver_status == 'ENROLLED':
            # Employer must contribute 3% for enrolled members
            self.kiwisaver_employer = self.gross_salary * 0.03

        self.employer_acc = self.gross_salary * 0.01  # Employer ACC levy
