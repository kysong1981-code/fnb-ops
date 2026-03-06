from django.db import models
from users.models import Organization, UserProfile
from decimal import Decimal

# Status Choices
CLOSING_STATUS_CHOICES = (
    ('DRAFT', 'Draft'),
    ('SUBMITTED', 'Submitted'),
    ('APPROVED', 'Approved'),
    ('REJECTED', 'Rejected'),
)


class Supplier(models.Model):
    """공급사 정보"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='suppliers')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    contact = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        unique_together = ('organization', 'code')

    def __str__(self):
        return f"{self.name} ({self.code})"


class DailyClosing(models.Model):
    """일일 폐점 데이터"""
    # 기본 정보
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='daily_closings')
    closing_date = models.DateField()
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='closings_created')
    approved_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='closings_approved')

    # POS 데이터 (자동 연동 예정, 지금은 수동)
    pos_card = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    pos_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # 실제 입력 데이터
    actual_card = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    actual_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # 상태
    status = models.CharField(max_length=20, choices=CLOSING_STATUS_CHOICES, default='DRAFT')

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-closing_date']
        unique_together = ('organization', 'closing_date')
        indexes = [
            models.Index(fields=['organization', 'closing_date']),
            models.Index(fields=['status', 'closing_date']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.closing_date}"

    @property
    def pos_total(self):
        """POS 총합"""
        return self.pos_card + self.pos_cash

    @property
    def actual_total(self):
        """실제 총합"""
        return self.actual_card + self.actual_cash

    @property
    def card_variance(self):
        """카드 배리언스 = POS - Actual"""
        return self.pos_card - self.actual_card

    @property
    def cash_variance(self):
        """현금 배리언스 = POS - Actual"""
        return self.pos_cash - self.actual_cash

    @property
    def total_variance(self):
        """총 배리언스 = POS Total - Actual Total"""
        return self.pos_total - self.actual_total


class ClosingSupplierCost(models.Model):
    """일일 폐점 시 공급사별 비용"""
    closing = models.ForeignKey(DailyClosing, on_delete=models.CASCADE, related_name='supplier_costs')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['supplier__name']
        indexes = [
            models.Index(fields=['closing', 'supplier']),
        ]

    def __str__(self):
        return f"{self.closing} - {self.supplier.name}: {self.amount}"
