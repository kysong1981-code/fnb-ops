from rest_framework import serializers
from django.utils import timezone
from .models import (
    DailyClosing, ClosingSupplierCost, Supplier, SalesCategory,
    ClosingHRCash, ClosingCashExpense, ClosingOtherSale,
    SupplierMonthlyStatement, EXPENSE_CATEGORY_CHOICES,
    CQAccountBalance, CQExpense
)
from users.models import UserProfile
from django.contrib.auth.models import User


class SupplierSerializer(serializers.ModelSerializer):
    """공급사 시리얼라이저"""
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Supplier
        fields = ['id', 'name', 'code', 'category', 'category_display', 'contact', 'phone', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SalesCategorySerializer(serializers.ModelSerializer):
    """매출 카테고리 시리얼라이저"""
    class Meta:
        model = SalesCategory
        fields = ['id', 'name', 'is_active', 'sort_order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserSimpleSerializer(serializers.ModelSerializer):
    """간단한 사용자 정보"""
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name']


class ClosingSupplierCostSerializer(serializers.ModelSerializer):
    """공급사 비용 시리얼라이저"""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    closing_date = serializers.DateField(source='closing.closing_date', read_only=True)

    class Meta:
        model = ClosingSupplierCost
        fields = ['id', 'closing', 'closing_date', 'supplier', 'supplier_name', 'amount', 'description', 'invoice_number', 'created_at', 'updated_at']
        read_only_fields = ['id', 'closing_date', 'created_at', 'updated_at', 'supplier_name']


class ClosingOtherSaleSerializer(serializers.ModelSerializer):
    """기타 매출 시리얼라이저"""
    class Meta:
        model = ClosingOtherSale
        fields = ['id', 'closing', 'name', 'amount', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ClosingHRCashSerializer(serializers.ModelSerializer):
    """HR 현금 입력 시리얼라이저"""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = ClosingHRCash
        fields = ['id', 'daily_closing', 'amount', 'recipient_name', 'photo', 'notes', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'created_by_name']
        extra_kwargs = {
            'photo': {'required': False, 'allow_null': True},
            'recipient_name': {'required': False},
        }

    def validate_photo(self, value):
        """사진 파일 크기 및 형식 검증"""
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("파일 크기는 5MB 이하여야 합니다.")
            allowed_extensions = ['jpg', 'jpeg', 'png']
            file_ext = value.name.split('.')[-1].lower()
            if file_ext not in allowed_extensions:
                raise serializers.ValidationError(f"허용된 파일 형식: {', '.join(allowed_extensions)}")
        return value


class ClosingCashExpenseSerializer(serializers.ModelSerializer):
    """현금 지출 시리얼라이저 (파일 업로드 포함)"""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = ClosingCashExpense
        fields = [
            'id', 'daily_closing', 'category', 'category_display', 'reason',
            'amount', 'notes', 'attachment', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'created_by_name', 'category_display']
        extra_kwargs = {
            'attachment': {'required': False, 'allow_null': True}
        }

    def validate_amount(self, value):
        """지출 금액은 양수여야 함"""
        if value <= 0:
            raise serializers.ValidationError("지출 금액은 0보다 커야 합니다.")
        return value

    def validate_attachment(self, value):
        """파일 크기 및 형식 검증"""
        if value:
            # 파일 크기 검증 (5MB)
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("파일 크기는 5MB 이하여야 합니다.")

            # 파일 형식 검증
            allowed_extensions = ['pdf', 'jpg', 'jpeg', 'png']
            file_ext = value.name.split('.')[-1].lower()
            if file_ext not in allowed_extensions:
                raise serializers.ValidationError(f"허용된 파일 형식: {', '.join(allowed_extensions)}")

        return value

    def create(self, validated_data):
        # Auto-set created_by to current user
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class DailyClosingListSerializer(serializers.ModelSerializer):
    """클로징 목록 조회용 시리얼라이저 (간단한 정보)"""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user.get_full_name', read_only=True, allow_null=True)
    card_variance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    cash_variance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = DailyClosing
        fields = [
            'id', 'organization', 'organization_name', 'closing_date',
            'pos_total', 'actual_total', 'card_variance', 'cash_variance', 'total_variance',
            'status', 'created_by_name', 'approved_by_name',
            'created_at', 'updated_at', 'approved_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'organization_name', 'created_by_name', 'approved_by_name',
            'pos_total', 'actual_total', 'card_variance', 'cash_variance', 'total_variance'
        ]


class DailyClosingDetailSerializer(serializers.ModelSerializer):
    """클로징 상세 조회 및 생성용 시리얼라이저"""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user.get_full_name', read_only=True, allow_null=True)

    # 중첩 시리얼라이저
    hr_cash_entries = ClosingHRCashSerializer(many=True, read_only=True)
    cash_expenses = ClosingCashExpenseSerializer(many=True, read_only=True)
    supplier_costs = ClosingSupplierCostSerializer(many=True, read_only=True)
    other_sales = ClosingOtherSaleSerializer(many=True, read_only=True)

    # 읽기 전용 프로퍼티
    pos_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    actual_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    card_variance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    cash_variance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_variance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    # HR Cash 활성화 여부
    hr_cash_enabled = serializers.SerializerMethodField()

    class Meta:
        model = DailyClosing
        fields = [
            'id', 'organization', 'organization_name', 'closing_date',
            'pos_card', 'pos_cash', 'tab_count', 'pos_total',
            'actual_card', 'actual_cash', 'bank_deposit', 'actual_total',
            'card_variance', 'cash_variance', 'total_variance',
            'variance_note',
            'hr_cash_enabled', 'hr_cash_entries', 'cash_expenses',
            'supplier_costs', 'other_sales',
            'status', 'created_by', 'created_by_name',
            'approved_by', 'approved_by_name',
            'created_at', 'updated_at', 'approved_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'approved_at',
            'organization_name', 'created_by_name', 'approved_by_name',
            'pos_total', 'actual_total',
            'card_variance', 'cash_variance', 'total_variance',
            'hr_cash_enabled', 'hr_cash_entries', 'cash_expenses',
            'supplier_costs', 'other_sales'
        ]
        extra_kwargs = {
            'created_by': {'write_only': True},
            'approved_by': {'write_only': True}
        }

    def get_hr_cash_enabled(self, obj):
        """조직의 HR 현금 활성화 여부 반환"""
        return obj.organization.hr_cash_enabled

    def validate_pos_card(self, value):
        """POS 카드 금액은 0 이상이어야 함"""
        if value < 0:
            raise serializers.ValidationError("POS 카드 금액은 0 이상이어야 합니다.")
        return value

    def validate_pos_cash(self, value):
        """POS 현금은 0 이상이어야 함"""
        if value < 0:
            raise serializers.ValidationError("POS 현금은 0 이상이어야 합니다.")
        return value

    def validate_actual_card(self, value):
        """실제 카드 금액은 0 이상이어야 함"""
        if value < 0:
            raise serializers.ValidationError("실제 카드 금액은 0 이상이어야 합니다.")
        return value

    def validate_actual_cash(self, value):
        """실제 현금은 0 이상이어야 함"""
        if value < 0:
            raise serializers.ValidationError("실제 현금은 0 이상이어야 합니다.")
        return value

    def validate(self, data):
        """상태별 검증 - 매니저는 모든 상태 수정 가능"""
        # Manager check is handled in the view layer
        return data

    def create(self, validated_data):
        # Auto-set created_by to current user's profile
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user.profile
        return super().create(validated_data)


class SupplierMonthlyStatementSerializer(serializers.ModelSerializer):
    """공급사 월별 명세서 시리얼라이저"""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = SupplierMonthlyStatement
        fields = [
            'id', 'organization', 'supplier', 'supplier_name',
            'year', 'month',
            'statement_file', 'statement_total',
            'our_total', 'variance', 'status', 'status_display',
            'parsed_data',
            'uploaded_by', 'uploaded_by_name', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'our_total', 'variance', 'status',
            'parsed_data',
            'created_at', 'updated_at',
            'supplier_name', 'uploaded_by_name', 'status_display'
        ]
        extra_kwargs = {
            'uploaded_by': {'write_only': True, 'required': False},
            'organization': {'required': False},
            'statement_total': {'required': False},  # Vision API can auto-fill
        }

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by and obj.uploaded_by.user:
            return obj.uploaded_by.user.get_full_name() or obj.uploaded_by.user.username
        return None

    def validate_statement_file(self, value):
        """파일 크기 및 형식 검증"""
        if value:
            if value.size > 10 * 1024 * 1024:
                raise serializers.ValidationError("File size must be 10MB or less.")
            allowed_extensions = ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls']
            file_ext = value.name.split('.')[-1].lower()
            if file_ext not in allowed_extensions:
                raise serializers.ValidationError(f"Allowed formats: {', '.join(allowed_extensions)}")
        return value


class MonthlyCloseSerializer(serializers.ModelSerializer):
    """Monthly close serializer"""
    closed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        from .models import MonthlyClose
        model = MonthlyClose
        fields = [
            'id', 'organization', 'year', 'month',
            'status', 'status_display',
            'closed_by', 'closed_by_name', 'closed_at',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'closed_by', 'closed_at',
            'created_at', 'updated_at',
        ]

    def get_closed_by_name(self, obj):
        if obj.closed_by and obj.closed_by.user:
            return obj.closed_by.user.get_full_name() or obj.closed_by.user.username
        return None


class CQAccountBalanceSerializer(serializers.ModelSerializer):
    """CQ 계정 발란스 시리얼라이저"""
    account_display = serializers.CharField(source='get_account_display', read_only=True)

    class Meta:
        model = CQAccountBalance
        fields = ['id', 'organization', 'account', 'account_display', 'balance', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class CQExpenseSerializer(serializers.ModelSerializer):
    """CQ Expense 시리얼라이저"""
    account_display = serializers.CharField(source='get_account_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = CQExpense
        fields = [
            'id', 'organization', 'account', 'account_display',
            'category', 'category_display',
            'description', 'amount',
            'exchange_rate', 'krw_amount',
            'attachment',
            'status', 'status_display',
            'created_by', 'created_by_name',
            'approved_by', 'approved_by_name',
            'date', 'created_at', 'approved_at',
        ]
        read_only_fields = [
            'id', 'status', 'created_by', 'approved_by',
            'created_at', 'approved_at',
        ]
        extra_kwargs = {
            'organization': {'required': False},
            'attachment': {'required': False, 'allow_null': True},
        }

    def get_created_by_name(self, obj):
        if obj.created_by and obj.created_by.user:
            return obj.created_by.user.get_full_name() or obj.created_by.user.username
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by and obj.approved_by.user:
            return obj.approved_by.user.get_full_name() or obj.approved_by.user.username
        return None

    def validate_attachment(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("File size must be 5MB or less.")
            allowed_extensions = ['jpg', 'jpeg', 'png', 'pdf']
            file_ext = value.name.split('.')[-1].lower()
            if file_ext not in allowed_extensions:
                raise serializers.ValidationError(f"Allowed formats: {', '.join(allowed_extensions)}")
        return value
