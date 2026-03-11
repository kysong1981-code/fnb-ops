from rest_framework import serializers
from .models import Salary, PayPeriod, PaySlip, PublicHoliday, LeaveBalance, LeaveRequest, PayDayFiling


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
        read_only_fields = ['id', 'created_at', 'updated_at', 'user_name', 'employee_id', 'organization']


class PayPeriodSerializer(serializers.ModelSerializer):
    """급여 지급 기간 시리얼라이저"""
    payslip_count = serializers.SerializerMethodField()
    total_net = serializers.SerializerMethodField()

    class Meta:
        model = PayPeriod
        fields = [
            'id', 'organization', 'period_type',
            'start_date', 'end_date', 'payment_date',
            'status', 'is_finalized',
            'payslip_count', 'total_net',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'payslip_count', 'total_net', 'organization']

    def get_payslip_count(self, obj):
        return obj.pay_slips.count()

    def get_total_net(self, obj):
        total = sum(ps.net_salary for ps in obj.pay_slips.all())
        return str(total)


class PaySlipDetailSerializer(serializers.ModelSerializer):
    """급여명세서 상세 시리얼라이저 (NZ compliant)"""
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='user.employee_id', read_only=True)
    work_type = serializers.CharField(source='user.work_type', read_only=True)
    tax_file_number = serializers.CharField(source='user.tax_file_number', read_only=True)
    kiwisaver_rate = serializers.CharField(source='user.kiwisaver_rate', read_only=True)
    pay_period_details = PayPeriodSerializer(source='pay_period', read_only=True)

    class Meta:
        model = PaySlip
        fields = [
            'id', 'pay_period', 'pay_period_details',
            'user', 'user_name', 'employee_id', 'work_type', 'tax_file_number',
            'tax_code', 'kiwisaver_rate',
            # Hours
            'regular_hours', 'overtime_hours', 'public_holiday_hours', 'total_hours',
            # Rates
            'hourly_rate', 'overtime_rate',
            # Earnings
            'regular_pay', 'overtime_pay', 'public_holiday_pay', 'holiday_pay', 'gross_salary',
            # Employee deductions
            'paye_tax', 'kiwisaver', 'student_loan_deduction', 'acc_levy',
            'other_deductions', 'total_deductions',
            # Net
            'net_salary',
            # Employer contributions
            'kiwisaver_employer', 'esct', 'employer_acc',
            # Public holiday tracking
            'alternative_holidays_earned',
            # Meta
            'notes', 'is_locked',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'user_name', 'employee_id', 'work_type', 'tax_file_number', 'kiwisaver_rate',
            'regular_pay', 'overtime_pay', 'public_holiday_pay', 'holiday_pay', 'gross_salary',
            'paye_tax', 'kiwisaver', 'student_loan_deduction', 'acc_levy',
            'total_deductions', 'net_salary',
            'kiwisaver_employer', 'esct', 'employer_acc',
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
            'total_hours', 'gross_salary',
            'holiday_pay', 'public_holiday_pay',
            'total_deductions', 'net_salary',
            'is_locked',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'user_name', 'employee_id']

    def get_period_info(self, obj):
        return {
            'start_date': obj.pay_period.start_date,
            'end_date': obj.pay_period.end_date,
            'payment_date': obj.pay_period.payment_date
        }


class PublicHolidaySerializer(serializers.ModelSerializer):
    """NZ Public Holiday 시리얼라이저"""
    class Meta:
        model = PublicHoliday
        fields = [
            'id', 'date', 'observed_date', 'name',
            'is_national', 'region', 'year'
        ]
        read_only_fields = ['id']


class LeaveBalanceSerializer(serializers.ModelSerializer):
    """Leave Balance 시리얼라이저"""
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='user.employee_id', read_only=True)
    leave_type_display = serializers.CharField(source='get_leave_type_display', read_only=True)

    class Meta:
        model = LeaveBalance
        fields = [
            'id', 'user', 'user_name', 'employee_id',
            'organization', 'leave_type', 'leave_type_display',
            'balance_hours', 'accrued_hours', 'used_hours',
            'entitlement_date', 'last_anniversary', 'year',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user_name', 'employee_id', 'leave_type_display']


class LeaveRequestSerializer(serializers.ModelSerializer):
    """Leave Request 시리얼라이저"""
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='user.employee_id', read_only=True)
    leave_type_display = serializers.CharField(source='get_leave_type_display', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user.get_full_name', read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'user', 'user_name', 'employee_id',
            'organization', 'leave_type', 'leave_type_display',
            'start_date', 'end_date', 'total_hours',
            'reason', 'status',
            'approved_by', 'approved_by_name', 'approved_at',
            'decline_reason', 'paid_amount',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'user_name', 'employee_id', 'leave_type_display',
            'approved_by_name', 'approved_at', 'paid_amount'
        ]


class PayDayFilingSerializer(serializers.ModelSerializer):
    """PayDay Filing 시리얼라이저"""
    pay_period_info = serializers.SerializerMethodField()

    class Meta:
        model = PayDayFiling
        fields = [
            'id', 'pay_period', 'pay_period_info',
            'organization', 'status',
            'file_data', 'generated_at', 'filed_at',
            'due_date', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'pay_period_info']

    def get_pay_period_info(self, obj):
        return {
            'start_date': obj.pay_period.start_date,
            'end_date': obj.pay_period.end_date,
            'payment_date': obj.pay_period.payment_date,
            'period_type': obj.pay_period.period_type,
        }
