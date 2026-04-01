from rest_framework import serializers
from .models import Report, GeneratedReport, SkyReport, StoreEvaluation, ProfitShare, PartnerShare


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
    locked_by_name = serializers.SerializerMethodField()
    yoy = serializers.SerializerMethodField()
    kpis = serializers.SerializerMethodField()
    opening_hours_per_day = serializers.SerializerMethodField()

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
            # Lock
            'is_locked', 'locked_by_name',
            # Meta
            'created_by_name', 'created_at', 'updated_at',
            # Extra computed
            'yoy', 'kpis', 'opening_hours_per_day',
        ]
        read_only_fields = ['id', 'is_locked', 'locked_by_name', 'created_at', 'updated_at', 'created_by_name']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.user.get_full_name() or obj.created_by.user.username
        return None

    def get_locked_by_name(self, obj):
        if obj.locked_by:
            return obj.locked_by.user.get_full_name() or obj.locked_by.user.username
        return None

    def get_yoy(self, obj):
        """Year-over-year comparison with same month last year."""
        try:
            prev = SkyReport.objects.get(
                organization=obj.organization, year=obj.year - 1, month=obj.month
            )
        except SkyReport.DoesNotExist:
            return None

        def pct_change(curr, prev_val):
            if not prev_val or prev_val == 0:
                return None
            return round(float((curr - prev_val) / abs(prev_val) * 100), 1)

        return {
            'sales': pct_change(obj.total_sales_inc_gst, prev.total_sales_inc_gst),
            'cogs': pct_change(obj.cogs, prev.cogs),
            'labour': pct_change(obj.sales_per_hour, prev.sales_per_hour),
            'profit': pct_change(obj.operating_profit, prev.operating_profit),
            'prev_sales': float(prev.total_sales_inc_gst),
            'prev_cogs': float(prev.cogs),
            'prev_labour': float(prev.sales_per_hour),
            'prev_profit': float(prev.operating_profit),
        }

    def get_kpis(self, obj):
        """Calculate additional KPIs."""
        from datetime import datetime as dt2, timedelta as td2, date as d2
        excl_gst = float(obj.excl_gst_sales) if obj.excl_gst_sales else 0
        tabs = float(obj.pos_sales) if obj.pos_sales else 0
        days = obj.number_of_days or 0
        profit = float(obj.operating_profit) if obj.operating_profit else 0
        total_work_hours = float(obj.other_sales) if obj.other_sales else 0  # repurposed

        # Opening hours from Organization settings (opening_time/closing_time)
        opening_hours_per_day = 0
        org = obj.organization
        if org and org.opening_time and org.closing_time:
            open_dt = dt2.combine(d2.today(), org.opening_time)
            close_dt = dt2.combine(d2.today(), org.closing_time)
            if close_dt <= open_dt:
                close_dt += td2(days=1)
            opening_hours_per_day = (close_dt - open_dt).seconds / 3600
        total_opening_hours = days * opening_hours_per_day

        return {
            'profit_ratio': round(profit / excl_gst * 100, 1) if excl_gst else 0,
            'sales_per_tab': round(excl_gst / tabs, 2) if tabs else 0,
            'sales_per_day': round(excl_gst / days, 2) if days else 0,
            'sales_per_labour_hour': round(excl_gst / total_work_hours, 2) if total_work_hours else 0,
            'sales_per_opening_hour': round(excl_gst / total_opening_hours, 2) if total_opening_hours else 0,
        }

    def get_opening_hours_per_day(self, obj):
        """Get opening hours/day from Organization settings."""
        from datetime import datetime as dt2, timedelta as td2, date as d2
        org = obj.organization
        if org and org.opening_time and org.closing_time:
            open_dt = dt2.combine(d2.today(), org.opening_time)
            close_dt = dt2.combine(d2.today(), org.closing_time)
            if close_dt <= open_dt:
                close_dt += td2(days=1)
            return (close_dt - open_dt).seconds / 3600
        return 0


class StoreEvaluationSerializer(serializers.ModelSerializer):
    """Store Evaluation serializer"""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    period_display = serializers.CharField(source='get_period_type_display', read_only=True)
    manager_type_display = serializers.CharField(source='get_manager_type_display', read_only=True)

    class Meta:
        model = StoreEvaluation
        fields = [
            'id', 'organization', 'organization_name',
            'period_type', 'period_display', 'year',
            'manager_type', 'manager_type_display',
            # Basic inputs
            'net_profit', 'account_profit', 'cash_profit',
            'guarantee_pct', 'guarantee_amount',
            'incentive_amount', 'incentive_pct', 'incentive_pool',
            'equity_share', 'staff_count', 'staff_incentive_pct',
            # Targets
            'sales_target', 'cogs_target', 'wage_target',
            # Achievements
            'sales_achievement', 'cogs_achievement', 'wage_achievement',
            'service_rating', 'hygiene_months', 'leadership_score',
            # Auto-calculated scores
            'sales_score', 'cogs_score', 'wage_score',
            'service_score', 'hygiene_score', 'leadership_score_points',
            'total_score', 'payout_ratio',
            # Lock
            'is_locked',
            # Meta
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'organization', 'organization_name',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
            'period_display', 'manager_type_display',
            # Auto-calculated
            'sales_score', 'cogs_score', 'wage_score',
            'service_score', 'hygiene_score', 'leadership_score_points',
            'total_score', 'payout_ratio',
            'guarantee_amount', 'incentive_pool',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.user.get_full_name() or obj.created_by.user.username
        return None


class PartnerShareSerializer(serializers.ModelSerializer):
    """Individual partner share serializer"""
    partner_type_display = serializers.CharField(source='get_partner_type_display', read_only=True)

    class Meta:
        model = PartnerShare
        fields = [
            'id', 'name', 'partner_type', 'partner_type_display',
            'incentive_pct', 'equity_pct',
            'incentive_account', 'incentive_cash',
            'bank_account', 'bank_cash',
            'total_account', 'total_cash', 'total',
            'fixed_amount', 'notes', 'order',
        ]
        read_only_fields = [
            'id', 'partner_type_display',
            'incentive_account', 'incentive_cash',
            'bank_account', 'bank_cash',
            'total_account', 'total_cash', 'total',
        ]


class ProfitShareSerializer(serializers.ModelSerializer):
    """Profit share serializer with nested partners"""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    period_display = serializers.CharField(source='get_period_type_display', read_only=True)
    partners = PartnerShareSerializer(many=True, required=False)

    class Meta:
        model = ProfitShare
        fields = [
            'id', 'organization', 'organization_name',
            'year', 'period_type', 'period_display',
            # Revenue
            'account_revenue', 'account_25', 'total_revenue',
            # Tax
            'tax',
            # Bank
            'bank_account', 'bank_cash', 'total_bank',
            # Net Profit
            'net_profit_account', 'net_profit_cash',
            # Incentive
            'incentive_account', 'incentive_cash', 'incentive_total', 'incentive_pct',
            # Evaluation Score
            'evaluation_score',
            # Lock & Notes
            'is_locked', 'notes',
            # Partners
            'partners',
            # Meta
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'organization', 'organization_name',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
            'period_display',
            'total_revenue', 'total_bank', 'incentive_total',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.user.get_full_name() or obj.created_by.user.username
        return None

    def create(self, validated_data):
        partners_data = validated_data.pop('partners', [])
        instance = ProfitShare.objects.create(**validated_data)
        instance.calculate_totals()
        instance.save()
        for partner_data in partners_data:
            partner = PartnerShare.objects.create(profit_share=instance, **partner_data)
            partner.calculate_amounts()
            partner.save()
        # Recalculate owner after all partners created
        for partner in instance.partners.filter(partner_type='OWNER'):
            partner.calculate_amounts()
            partner.save()
        return instance

    def update(self, instance, validated_data):
        partners_data = validated_data.pop('partners', None)

        # Update ProfitShare fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.calculate_totals()
        instance.save()

        if partners_data is not None:
            # Replace all partners
            existing_ids = set(instance.partners.values_list('id', flat=True))
            incoming_ids = set()

            for partner_data in partners_data:
                pid = partner_data.get('id')
                if pid and pid in existing_ids:
                    # Update existing
                    partner = PartnerShare.objects.get(id=pid, profit_share=instance)
                    for attr, value in partner_data.items():
                        if attr != 'id':
                            setattr(partner, attr, value)
                    partner.calculate_amounts()
                    partner.save()
                    incoming_ids.add(pid)
                else:
                    # Create new
                    partner_data.pop('id', None)
                    partner = PartnerShare.objects.create(profit_share=instance, **partner_data)
                    partner.calculate_amounts()
                    partner.save()
                    incoming_ids.add(partner.id)

            # Delete removed partners
            to_delete = existing_ids - incoming_ids
            instance.partners.filter(id__in=to_delete).delete()

            # Recalculate owner after all partners updated
            for partner in instance.partners.filter(partner_type='OWNER'):
                partner.calculate_amounts()
                partner.save()

        return instance
