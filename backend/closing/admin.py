from django.contrib import admin
from .models import (
    Supplier, DailyClosing, ClosingSupplierCost,
    ClosingHRCash, ClosingCashExpense, SupplierMonthlyStatement,
    MonthlyClose, SalesCategory, ClosingOtherSale,
    CQAccountBalance, CQExpense
)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    """공급사 관리"""
    list_display = ('name', 'code', 'organization', 'is_active', 'created_at')
    list_filter = ('is_active', 'organization', 'created_at')
    search_fields = ('name', 'code')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('기본 정보', {
            'fields': ('organization', 'name', 'code')
        }),
        ('연락처', {
            'fields': ('contact', 'phone')
        }),
        ('상태', {
            'fields': ('is_active',)
        }),
        ('타임스탬프', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(DailyClosing)
class DailyClosingAdmin(admin.ModelAdmin):
    """데일리 클로징 관리"""
    list_display = ('organization', 'closing_date', 'pos_total', 'actual_total', 'total_variance', 'status', 'created_at')
    list_filter = ('status', 'organization', 'closing_date')
    search_fields = ('organization__name',)
    readonly_fields = ('pos_total', 'actual_total', 'card_variance', 'cash_variance', 'total_variance', 'created_at', 'updated_at')
    date_hierarchy = 'closing_date'

    fieldsets = (
        ('기본 정보', {
            'fields': ('organization', 'closing_date', 'status')
        }),
        ('POS 데이터', {
            'fields': ('pos_card', 'pos_cash', 'pos_total')
        }),
        ('실제 데이터', {
            'fields': ('actual_card', 'actual_cash', 'actual_total')
        }),
        ('배리언스', {
            'fields': ('card_variance', 'cash_variance', 'total_variance'),
            'classes': ('collapse',)
        }),
        ('승인 정보', {
            'fields': ('created_by', 'approved_by', 'approved_at'),
            'classes': ('collapse',)
        }),
        ('타임스탬프', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def has_delete_permission(self, request, obj=None):
        """DRAFT 상태만 삭제 가능"""
        if obj and obj.status == 'DRAFT':
            return True
        return False


@admin.register(ClosingSupplierCost)
class ClosingSupplierCostAdmin(admin.ModelAdmin):
    """클로징 공급사 비용 관리"""
    list_display = ('closing', 'supplier', 'amount', 'created_at')
    list_filter = ('supplier__organization', 'supplier', 'created_at')
    search_fields = ('closing__organization__name', 'supplier__name')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('기본 정보', {
            'fields': ('closing', 'supplier')
        }),
        ('비용', {
            'fields': ('amount', 'description')
        }),
        ('타임스탬프', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ClosingHRCash)
class ClosingHRCashAdmin(admin.ModelAdmin):
    """클로징 HR 현금 관리"""
    list_display = ('daily_closing', 'amount', 'created_by', 'created_at')
    list_filter = ('daily_closing__organization', 'created_at')
    search_fields = ('daily_closing__organization__name',)
    readonly_fields = ('created_at', 'updated_at', 'created_by')

    fieldsets = (
        ('기본 정보', {
            'fields': ('daily_closing', 'amount')
        }),
        ('비고', {
            'fields': ('notes',)
        }),
        ('생성 정보', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        """이미 생성된 항목은 수정 불가"""
        if obj:  # 수정 시
            return self.readonly_fields + ['daily_closing', 'amount']
        return self.readonly_fields


@admin.register(ClosingCashExpense)
class ClosingCashExpenseAdmin(admin.ModelAdmin):
    """클로징 현금 지출 관리"""
    list_display = ('daily_closing', 'category', 'reason', 'amount', 'created_by', 'created_at')
    list_filter = ('category', 'daily_closing__organization', 'created_at')
    search_fields = ('reason', 'daily_closing__organization__name')
    readonly_fields = ('created_at', 'updated_at', 'created_by')
    date_hierarchy = 'created_at'

    fieldsets = (
        ('기본 정보', {
            'fields': ('daily_closing', 'category', 'reason')
        }),
        ('비용', {
            'fields': ('amount',)
        }),
        ('증빙', {
            'fields': ('attachment',)
        }),
        ('생성 정보', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        """이미 생성된 항목은 수정 불가"""
        if obj:  # 수정 시
            return self.readonly_fields + ['daily_closing', 'category', 'reason', 'amount']
        return self.readonly_fields


@admin.register(SupplierMonthlyStatement)
class SupplierMonthlyStatementAdmin(admin.ModelAdmin):
    """공급사 월별 명세서 관리"""
    list_display = ('supplier', 'organization', 'year', 'month', 'statement_total', 'our_total', 'variance', 'status')
    list_filter = ('status', 'year', 'month', 'organization')
    search_fields = ('supplier__name',)
    readonly_fields = ('our_total', 'variance', 'status', 'created_at', 'updated_at')


@admin.register(MonthlyClose)
class MonthlyCloseAdmin(admin.ModelAdmin):
    """Monthly close admin"""
    list_display = ('organization', 'year', 'month', 'status', 'closed_by', 'closed_at')
    list_filter = ('status', 'year', 'organization')
    search_fields = ('organization__name',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(SalesCategory)
class SalesCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'is_active')
    list_filter = ('organization', 'is_active')
    search_fields = ('name',)


@admin.register(ClosingOtherSale)
class ClosingOtherSaleAdmin(admin.ModelAdmin):
    list_display = ('closing', 'name', 'amount', 'created_at')
    list_filter = ('closing__organization', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('created_at',)


@admin.register(CQAccountBalance)
class CQAccountBalanceAdmin(admin.ModelAdmin):
    list_display = ('organization', 'account', 'balance', 'updated_by', 'updated_at')
    list_filter = ('organization', 'account')
    readonly_fields = ('updated_at',)


@admin.register(CQExpense)
class CQExpenseAdmin(admin.ModelAdmin):
    list_display = ('organization', 'account', 'category', 'description', 'amount', 'status', 'created_by', 'date')
    list_filter = ('organization', 'account', 'category', 'status')
    search_fields = ('description',)
    readonly_fields = ('created_at', 'updated_at', 'approved_at')
    date_hierarchy = 'date'
