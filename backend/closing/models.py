from django.db import models
from django.db.models import Sum
from django.contrib.auth.models import User
from users.models import Organization, UserProfile
from decimal import Decimal
from datetime import date

# Status Choices
CLOSING_STATUS_CHOICES = (
    ('DRAFT', 'Draft'),
    ('SUBMITTED', 'Submitted'),
    ('APPROVED', 'Approved'),
    ('REJECTED', 'Rejected'),
)

# Expense Category Choices
EXPENSE_CATEGORY_CHOICES = (
    ('SUPPLIES', '소비재'),
    ('MAINTENANCE', '유지보수'),
    ('OTHER', '기타'),
)


class Supplier(models.Model):
    """공급사 정보"""
    CATEGORY_CHOICES = [
        ('COGS', 'COGS'),
        ('MAINTENANCE', 'Maintenance'),
        ('GENERAL', 'General'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='suppliers')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='COGS')
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
    tab_count = models.IntegerField(default=0, help_text="POS 탭 수 (거래 건수)")

    # 실제 입력 데이터
    actual_card = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    actual_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # 은행 입금
    bank_deposit = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="은행 입금 금액")

    # Xero 연동 준비
    xero_invoice_id = models.CharField(max_length=255, null=True, blank=True, help_text="Xero invoice ID (future sync)")
    xero_status = models.CharField(
        max_length=50, null=True, blank=True, default='NOT_SYNCED',
        choices=(('NOT_SYNCED', 'Not Synced'), ('SYNCED', 'Synced'), ('ERROR', 'Sync Error')),
        help_text="Xero sync status"
    )

    # Variance note (required when variance exists)
    variance_note = models.TextField(null=True, blank=True, help_text="Variance reason/explanation")

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
        """카드 배리언스 = Actual - POS"""
        return self.actual_card - self.pos_card

    @property
    def cash_variance(self):
        """현금 배리언스 = Actual - POS"""
        return self.actual_cash - self.pos_cash

    @property
    def total_variance(self):
        """총 배리언스 = Actual Total - POS Total"""
        return self.actual_total - self.pos_total


class ClosingSupplierCost(models.Model):
    """일일 폐점 시 공급사별 비용 (같은 업체 인보이스 다건 입력 가능)"""
    closing = models.ForeignKey(DailyClosing, on_delete=models.CASCADE, related_name='supplier_costs')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(null=True, blank=True)
    invoice_number = models.CharField(max_length=100, null=True, blank=True, help_text="Invoice number from supplier")

    # Xero 연동 준비
    xero_invoice_id = models.CharField(max_length=255, null=True, blank=True, help_text="Xero invoice ID (future sync)")
    xero_status = models.CharField(
        max_length=50, null=True, blank=True, default='NOT_SYNCED',
        choices=(('NOT_SYNCED', 'Not Synced'), ('SYNCED', 'Synced'), ('ERROR', 'Sync Error')),
        help_text="Xero sync status"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['supplier__name']
        indexes = [
            models.Index(fields=['closing', 'supplier']),
        ]

    def __str__(self):
        supplier_name = self.supplier.name if self.supplier else 'Unknown'
        return f"{self.closing} - {supplier_name}: {self.amount}"


class ClosingOtherSale(models.Model):
    """일일 폐점 시 기타 매출 (SalesCategory 기반 또는 자유 입력)"""
    closing = models.ForeignKey(DailyClosing, on_delete=models.CASCADE, related_name='other_sales')
    name = models.CharField(max_length=255, help_text="매출 항목 이름 (e.g. Dining, Uber Eats)")
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['closing']),
        ]

    def __str__(self):
        return f"{self.closing} - {self.name}: {self.amount}"


class ClosingHRCash(models.Model):
    """클로징 시 HR 현금 입력 (스토어별로 활성화/비활성화 가능)"""
    daily_closing = models.ForeignKey(DailyClosing, on_delete=models.CASCADE, related_name='hr_cash_entries')
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="HR 현금 금액")
    recipient_name = models.CharField(max_length=100, blank=True, default='', help_text="수령인 이름")
    photo = models.ImageField(upload_to='closing/hr_cash/%Y/%m/%d/', blank=True, null=True, help_text="수령 증빙 사진")
    notes = models.TextField(null=True, blank=True, help_text="HR 현금 비고")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='hr_cash_entries_created')

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Closing HR Cash"
        verbose_name_plural = "Closing HR Cashes"

    def __str__(self):
        return f"{self.daily_closing} - HR Cash: {self.amount}"


class SalesCategory(models.Model):
    """매출 카테고리 (Store Settings에서 정의, Daily Closing에서 자동 표시)"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='sales_categories')
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']
        unique_together = ('organization', 'name')
        verbose_name_plural = 'Sales Categories'

    def __str__(self):
        return f"{self.name}"


class ClosingCashExpense(models.Model):
    """클로징 시 현금 지출 기록 (영수증/파일 첨부 포함)"""
    daily_closing = models.ForeignKey(DailyClosing, on_delete=models.CASCADE, related_name='cash_expenses')
    category = models.CharField(max_length=20, choices=EXPENSE_CATEGORY_CHOICES, help_text="지출 카테고리")
    reason = models.CharField(max_length=200, help_text="지출 사유")
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="지출 금액")
    notes = models.TextField(blank=True, default='', help_text="메모")
    attachment = models.FileField(
        upload_to='closing/expenses/%Y/%m/%d/',
        blank=True,
        null=True,
        help_text="영수증 또는 증빙 파일 (PDF, JPG, PNG 최대 5MB)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='cash_expenses_created')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['daily_closing', 'category']),
        ]
        verbose_name = "Closing Cash Expense"
        verbose_name_plural = "Closing Cash Expenses"

    def __str__(self):
        return f"{self.daily_closing} - {self.reason}: {self.amount}"


# Statement Status Choices
STATEMENT_STATUS_CHOICES = (
    ('PENDING', 'Pending Review'),
    ('MATCHED', 'Matched'),
    ('MISMATCHED', 'Mismatched'),
)


class SupplierMonthlyStatement(models.Model):
    """월별 공급사 명세서 업로드 및 대사(reconciliation)"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='supplier_statements')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='monthly_statements')

    # Period
    year = models.IntegerField(help_text="Settlement year")
    month = models.IntegerField(help_text="Settlement month (1-12)")

    # Statement data
    statement_file = models.FileField(
        upload_to='closing/supplier_statements/%Y/%m/',
        help_text="Supplier statement file (PDF, JPG, PNG, XLSX max 10MB)"
    )
    statement_total = models.DecimalField(
        max_digits=12, decimal_places=2,
        help_text="Total amount on the supplier statement"
    )

    # Our computed total (cached)
    our_total = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Our total from ClosingSupplierCost entries"
    )

    # Reconciliation
    variance = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Variance = statement_total - our_total"
    )
    status = models.CharField(
        max_length=20, choices=STATEMENT_STATUS_CHOICES, default='PENDING'
    )

    # Vision API parsed data
    parsed_data = models.JSONField(
        null=True, blank=True,
        help_text="Parsed line items from Vision API: {total, line_items: [{date, description, amount}]}"
    )

    # Metadata
    uploaded_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True)
    notes = models.TextField(null=True, blank=True)

    # Xero 연동 준비
    xero_invoice_id = models.CharField(max_length=255, null=True, blank=True)
    xero_status = models.CharField(max_length=50, null=True, blank=True, default='NOT_SYNCED')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', '-month', 'supplier__name']
        unique_together = ('organization', 'supplier', 'year', 'month')
        indexes = [
            models.Index(fields=['organization', 'year', 'month']),
            models.Index(fields=['supplier', 'year', 'month']),
        ]

    def __str__(self):
        return f"{self.supplier.name} - {self.year}/{self.month:02d} ({self.get_status_display()})"

    def compute_our_total(self):
        """Compute total from ClosingSupplierCost entries for this supplier/month"""
        start_date = date(self.year, self.month, 1)
        if self.month == 12:
            end_date = date(self.year + 1, 1, 1)
        else:
            end_date = date(self.year, self.month + 1, 1)

        total = ClosingSupplierCost.objects.filter(
            closing__organization=self.organization,
            supplier=self.supplier,
            closing__closing_date__gte=start_date,
            closing__closing_date__lt=end_date,
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        return total

    def reconcile(self):
        """Run reconciliation: compute our_total, set variance, update status"""
        self.our_total = self.compute_our_total()
        self.variance = self.statement_total - self.our_total

        if self.variance == Decimal('0'):
            self.status = 'MATCHED'
        else:
            self.status = 'MISMATCHED'

        self.save()


# Monthly Close Status Choices
MONTHLY_CLOSE_STATUS_CHOICES = (
    ('OPEN', 'Open'),
    ('CLOSED', 'Closed'),
)


class MonthlyClose(models.Model):
    """Monthly close gate — once CLOSED, daily closings in that month become read-only."""
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='monthly_closes'
    )
    year = models.IntegerField(help_text='Year')
    month = models.IntegerField(help_text='Month (1-12)')
    status = models.CharField(
        max_length=10, choices=MONTHLY_CLOSE_STATUS_CHOICES, default='OPEN'
    )
    closed_by = models.ForeignKey(
        UserProfile, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='months_closed'
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True, help_text='Close/reopen notes')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', '-month']
        unique_together = ('organization', 'year', 'month')

    def __str__(self):
        return f"{self.organization.name} - {self.year}/{self.month:02d} ({self.status})"


# CQ Account Choices
CQ_ACCOUNT_CHOICES = (
    ('CHCH', 'ChCh'),
    ('QT', 'QT'),
    ('KRW', 'KRW'),
)

CQ_EXPENSE_STATUS_CHOICES = (
    ('PENDING', 'Pending'),
    ('APPROVED', 'Approved'),
)

CQ_EXPENSE_CATEGORY_CHOICES = (
    ('EXPENSE', 'Expense'),
    ('TRANSFER', 'Transfer'),
    ('EXCHANGE', 'Exchange'),
)


class CQAccountBalance(models.Model):
    """CQ 계정 발란스 (직접 입력)"""
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='cq_balances'
    )
    account = models.CharField(max_length=10, choices=CQ_ACCOUNT_CHOICES)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    updated_by = models.ForeignKey(
        UserProfile, on_delete=models.SET_NULL, null=True, blank=True
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['organization', 'account']

    def __str__(self):
        return f"{self.organization.name} - {self.get_account_display()} ({self.balance})"


class CQExpense(models.Model):
    """CQ Expense (건별 승인)"""
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='cq_expenses'
    )
    account = models.CharField(max_length=10, choices=CQ_ACCOUNT_CHOICES)
    category = models.CharField(
        max_length=10, choices=CQ_EXPENSE_CATEGORY_CHOICES, default='EXPENSE'
    )
    description = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    exchange_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Exchange rate (1 NZD = ? KRW)'
    )
    krw_amount = models.DecimalField(
        max_digits=15, decimal_places=0, null=True, blank=True,
        help_text='KRW amount received from exchange'
    )
    attachment = models.FileField(
        upload_to='cq/expenses/%Y/%m/', blank=True, null=True
    )
    status = models.CharField(
        max_length=10, choices=CQ_EXPENSE_STATUS_CHOICES, default='PENDING'
    )
    created_by = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name='cq_expenses_created'
    )
    approved_by = models.ForeignKey(
        UserProfile, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cq_expenses_approved'
    )
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.get_account_display()} - {self.description} ({self.amount})"
