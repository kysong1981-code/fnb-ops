from rest_framework import serializers
from django.utils import timezone
from .models import (
    DailyClosing, ClosingSupplierCost, Supplier,
    ClosingHRCash, ClosingCashExpense, EXPENSE_CATEGORY_CHOICES
)
from users.models import UserProfile
from django.contrib.auth.models import User


class UserSimpleSerializer(serializers.ModelSerializer):
    """간단한 사용자 정보"""
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name']


class ClosingSupplierCostSerializer(serializers.ModelSerializer):
    """공급사 비용 시리얼라이저"""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = ClosingSupplierCost
        fields = ['id', 'closing', 'supplier', 'supplier_name', 'amount', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'supplier_name']


class ClosingHRCashSerializer(serializers.ModelSerializer):
    """HR 현금 입력 시리얼라이저"""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = ClosingHRCash
        fields = ['id', 'daily_closing', 'amount', 'notes', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by_name']
        extra_kwargs = {
            'created_by': {'write_only': True}
        }

    def create(self, validated_data):
        # Auto-set created_by to current user
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class ClosingCashExpenseSerializer(serializers.ModelSerializer):
    """현금 지출 시리얼라이저 (파일 업로드 포함)"""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = ClosingCashExpense
        fields = [
            'id', 'daily_closing', 'category', 'category_display', 'reason',
            'amount', 'attachment', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by_name', 'category_display']
        extra_kwargs = {
            'created_by': {'write_only': True},
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

    class Meta:
        model = DailyClosing
        fields = [
            'id', 'organization', 'organization_name', 'closing_date',
            'pos_total', 'actual_total', 'total_variance',
            'status', 'created_by_name', 'approved_by_name',
            'created_at', 'updated_at', 'approved_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'organization_name', 'created_by_name', 'approved_by_name',
            'pos_total', 'actual_total', 'total_variance'
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
            'pos_card', 'pos_cash', 'pos_total',
            'actual_card', 'actual_cash', 'actual_total',
            'card_variance', 'cash_variance', 'total_variance',
            'hr_cash_enabled', 'hr_cash_entries', 'cash_expenses', 'supplier_costs',
            'status', 'created_by', 'created_by_name',
            'approved_by', 'approved_by_name',
            'created_at', 'updated_at', 'approved_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'approved_at',
            'organization_name', 'created_by_name', 'approved_by_name',
            'pos_total', 'actual_total',
            'card_variance', 'cash_variance', 'total_variance',
            'hr_cash_enabled', 'hr_cash_entries', 'cash_expenses', 'supplier_costs'
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
        """상태별 검증"""
        # 업데이트 시 DRAFT 상태만 수정 가능
        if self.instance and self.instance.status != 'DRAFT':
            raise serializers.ValidationError(
                f"DRAFT 상태인 클로징만 수정할 수 있습니다. 현재 상태: {self.instance.status}"
            )
        return data

    def create(self, validated_data):
        # Auto-set created_by to current user
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by_id'] = request.user.id
        return super().create(validated_data)
