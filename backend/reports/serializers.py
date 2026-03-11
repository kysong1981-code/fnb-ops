from rest_framework import serializers
from .models import Report, GeneratedReport, SkyReport


class ReportSerializer(serializers.ModelSerializer):
    """리포트 설정 시리얼라이저"""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = Report
        fields = [
            'id', 'organization', 'organization_name',
            'report_type', 'title', 'description',
            'is_active', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'organization_name', 'created_by_name']


class GeneratedReportSerializer(serializers.ModelSerializer):
    """생성된 리포트 시리얼라이저"""
    report_title = serializers.CharField(source='report.title', read_only=True)
    report_type = serializers.CharField(source='report.report_type', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    generated_by_name = serializers.CharField(source='generated_by.user.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = GeneratedReport
        fields = [
            'id', 'report', 'report_title', 'report_type',
            'organization', 'organization_name',
            'report_date', 'period_start', 'period_end',
            'generated_by', 'generated_by_name',
            'generated_at', 'pdf_file'
        ]
        read_only_fields = [
            'id', 'generated_at', 'report_title', 'report_type',
            'organization_name', 'generated_by_name', 'pdf_file'
        ]


class SkyReportSerializer(serializers.ModelSerializer):
    month_display = serializers.CharField(source='get_month_display', read_only=True)
    excl_gst_sales = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    cogs_ratio = serializers.DecimalField(max_digits=5, decimal_places=1, read_only=True)
    wage_ratio = serializers.DecimalField(max_digits=5, decimal_places=1, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SkyReport
        fields = [
            'id', 'year', 'month', 'month_display',
            # Main financial
            'total_sales_inc_gst', 'hq_cash', 'pos_sales', 'other_sales',
            'cogs', 'operating_expenses', 'wages',
            'sales_per_hour', 'opening_sales_per_hour', 'tab_allowance_sales',
            'payable_gst', 'sub_gst', 'operating_profit',
            # Computed
            'excl_gst_sales', 'cogs_ratio', 'wage_ratio',
            # Input fields
            'total_sales_garage', 'hq_cash_garage',
            'total_cogs_xero', 'total_expense_xero',
            'labour_xero', 'sub_contractor_xero',
            'number_of_days', 'number_of_payruns',
            # Goals
            'sales_goal', 'cogs_goal', 'wage_goal',
            'review_rating', 'review_goal',
            # Hygiene
            'hygiene_grade',
            # Notes
            'sales_notes', 'cogs_notes', 'wage_notes', 'next_month_notes',
            # Meta
            'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by_name']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.user.get_full_name() or obj.created_by.user.username
        return None
