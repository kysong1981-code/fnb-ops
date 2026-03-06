from rest_framework import serializers
from .models import Salary, PayPeriod, PaySlip


class SalarySerializer(serializers.ModelSerializer):
    """시급 정보 시리얼라이저"""
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='user.employee_id', read_only=True)

    class Meta:
        model = Salary
        fields = [
            'id', 'user', 'user_name', 'employee_id',
            'organization', 'hourly_rate', 'overtime_multiplier',
            'effective_from', 'effective_to', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user_name', 'employee_id']


class PayPeriodSerializer(serializers.ModelSerializer):
    """급여 지급 기간 시리얼라이저"""
    class Meta:
        model = PayPeriod
        fields = [
            'id', 'organization', 'period_type',
            'start_date', 'end_date', 'payment_date',
            'is_finalized', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PaySlipDetailSerializer(serializers.ModelSerializer):
    """급여명세서 상세 시리얼라이저"""
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='user.employee_id', read_only=True)
    work_type = serializers.CharField(source='user.work_type', read_only=True)
    tax_file_number = serializers.CharField(source='user.tax_file_number', read_only=True)
    pay_period_details = PayPeriodSerializer(source='pay_period', read_only=True)

    class Meta:
        model = PaySlip
        fields = [
            'id', 'pay_period', 'pay_period_details',
            'user', 'user_name', 'employee_id', 'work_type', 'tax_file_number',
            'regular_hours', 'overtime_hours', 'total_hours',
            'hourly_rate', 'overtime_rate',
            'regular_pay', 'overtime_pay', 'gross_salary',
            'paye_tax', 'kiwisaver', 'acc_levy',
            'other_deductions', 'total_deductions',
            'net_salary',
            'kiwisaver_employer', 'employer_acc',
            'notes', 'is_locked',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'user_name', 'employee_id', 'work_type', 'tax_file_number',
            'regular_pay', 'overtime_pay', 'gross_salary',
            'paye_tax', 'kiwisaver', 'acc_levy',
            'total_deductions', 'net_salary',
            'kiwisaver_employer', 'employer_acc'
        ]


class PaySlipListSerializer(serializers.ModelSerializer):
    """급여명세서 목록 시리얼라이저"""
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='user.employee_id', read_only=True)
    period_info = serializers.SerializerMethodField()

    class Meta:
        model = PaySlip
        fields = [
            'id', 'pay_period', 'period_info',
            'user', 'user_name', 'employee_id',
            'total_hours', 'gross_salary', 'total_deductions', 'net_salary',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'user_name', 'employee_id']

    def get_period_info(self, obj):
        return {
            'start_date': obj.pay_period.start_date,
            'end_date': obj.pay_period.end_date,
            'payment_date': obj.pay_period.payment_date
        }
