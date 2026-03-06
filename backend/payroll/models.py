from django.db import models
from users.models import Organization, UserProfile


class PayPeriod(models.Model):
    """급여 지급 기간"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='pay_periods')

    # 기간
    start_date = models.DateField()
    end_date = models.DateField()
    payment_date = models.DateField()

    is_finalized = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']
        unique_together = ('organization', 'start_date', 'end_date')

    def __str__(self):
        return f"{self.organization.name} - {self.start_date} to {self.end_date}"


class PaySlip(models.Model):
    """급여명세서"""
    pay_period = models.ForeignKey(PayPeriod, on_delete=models.CASCADE, related_name='pay_slips')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='pay_slips')

    # 근무 시간
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # 급여 계산
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # 공제 (뉴질랜드)
    paye_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # 소득세
    kiwisaver = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # Kiwisaver
    acc_levy = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # 산재보험

    # 순급여
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-pay_period__start_date']
        unique_together = ('pay_period', 'user')

    def __str__(self):
        return f"{self.user.employee_id} - {self.pay_period}"
