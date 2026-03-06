from rest_framework import serializers
from .models import Onboarding, OnboardingTask, EmployeeDocument, Roster, Timesheet


class OnboardingTaskSerializer(serializers.ModelSerializer):
    """온보딩 작업 항목 시리얼라이저"""
    assigned_to_name = serializers.CharField(source='assigned_to.user.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = OnboardingTask
        fields = [
            'id', 'title', 'description', 'order', 'is_completed',
            'completed_at', 'assigned_to', 'assigned_to_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    """직원 문서 시리얼라이저"""
    signed_by_name = serializers.CharField(source='signed_by.user.get_full_name', read_only=True, allow_null=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.user.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = EmployeeDocument
        fields = [
            'id', 'document_type', 'title', 'file', 'is_signed',
            'signed_at', 'signed_by', 'signed_by_name',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at', 'download_count'
        ]
        read_only_fields = ['id', 'uploaded_at', 'download_count', 'signed_by_name', 'uploaded_by_name']


class OnboardingDetailSerializer(serializers.ModelSerializer):
    """온보딩 상세 조회 시리얼라이저"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.user.get_full_name', read_only=True, allow_null=True)
    tasks = OnboardingTaskSerializer(many=True, read_only=True)
    documents = EmployeeDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Onboarding
        fields = [
            'id', 'employee', 'employee_name', 'employee_id',
            'organization', 'status', 'completed_percentage',
            'notes', 'assigned_to', 'assigned_to_name',
            'tasks', 'documents', 'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'employee_name', 'employee_id']


class OnboardingListSerializer(serializers.ModelSerializer):
    """온보딩 목록 조회 시리얼라이저"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.user.get_full_name', read_only=True, allow_null=True)
    task_count = serializers.SerializerMethodField()
    completed_tasks = serializers.SerializerMethodField()

    class Meta:
        model = Onboarding
        fields = [
            'id', 'employee', 'employee_name', 'employee_id',
            'organization', 'status', 'completed_percentage',
            'assigned_to', 'assigned_to_name', 'task_count', 'completed_tasks',
            'created_at', 'completed_at'
        ]
        read_only_fields = ['id', 'created_at', 'employee_name', 'employee_id', 'task_count', 'completed_tasks']

    def get_task_count(self, obj):
        return obj.tasks.count()

    def get_completed_tasks(self, obj):
        return obj.tasks.filter(is_completed=True).count()


class RosterSerializer(serializers.ModelSerializer):
    """로스터 (근무 스케줄) 시리얼라이저"""
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='user.employee_id', read_only=True)
    hours = serializers.SerializerMethodField()

    class Meta:
        model = Roster
        fields = [
            'id', 'user', 'user_name', 'employee_id',
            'organization', 'date', 'shift_start', 'shift_end',
            'is_confirmed', 'hours', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user_name', 'employee_id', 'hours']

    def get_hours(self, obj):
        return round(obj.hours, 2)


class TimesheetSerializer(serializers.ModelSerializer):
    """타임시트 (출퇴근 기록) 시리얼라이저"""
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='user.employee_id', read_only=True)
    worked_hours = serializers.SerializerMethodField()

    class Meta:
        model = Timesheet
        fields = [
            'id', 'user', 'user_name', 'employee_id',
            'organization', 'date', 'check_in', 'check_out',
            'is_approved', 'notes', 'worked_hours',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user_name', 'employee_id', 'worked_hours']

    def get_worked_hours(self, obj):
        return round(obj.worked_hours, 2) if obj.worked_hours else 0
