from rest_framework import serializers
from .models import Report, GeneratedReport


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
