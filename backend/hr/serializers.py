from rest_framework import serializers
from .models import (
    Onboarding, OnboardingTask, EmployeeDocument, ShiftTemplate, Roster, Timesheet, Task,
    EmployeeInvite, DocumentTemplate, IR330Declaration, TrainingModule, Inquiry, ResignationRequest,
    DisciplinaryRecord, PerformanceReview, WorkplaceAccident, EmployeeNote,
)


class OnboardingTaskSerializer(serializers.ModelSerializer):
    """온보딩 작업 항목 시리얼라이저"""
    assigned_to_name = serializers.CharField(source='assigned_to.user.get_full_name', read_only=True, allow_null=True)
    related_document_detail = serializers.SerializerMethodField()
    related_training_detail = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingTask
        fields = [
            'id', 'title', 'description', 'order', 'step_type',
            'is_completed', 'completed_at', 'assigned_to', 'assigned_to_name',
            'related_document', 'related_document_detail',
            'related_training', 'related_training_detail',
            'upload_label', 'uploaded_file',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_related_document_detail(self, obj):
        if obj.related_document:
            return {
                'id': obj.related_document.id,
                'title': obj.related_document.title,
                'document_type': obj.related_document.document_type,
                'file': obj.related_document.file.url if obj.related_document.file else None,
                'is_signed': obj.related_document.is_signed,
            }
        return None

    def get_related_training_detail(self, obj):
        if obj.related_training:
            return {
                'id': obj.related_training.id,
                'title': obj.related_training.title,
                'module_type': obj.related_training.module_type,
                'description': obj.related_training.description,
                'file': obj.related_training.file.url if obj.related_training.file else None,
                'video_url': obj.related_training.video_url,
            }
        return None


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    """직원 문서 시리얼라이저"""
    signed_by_name = serializers.CharField(source='signed_by.user.get_full_name', read_only=True, allow_null=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.user.get_full_name', read_only=True, allow_null=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = EmployeeDocument
        fields = [
            'id', 'onboarding', 'employee', 'employee_name', 'organization',
            'document_type', 'title', 'file', 'pdf_file', 'is_signed',
            'signed_at', 'signed_by', 'signed_by_name',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at', 'download_count'
        ]
        read_only_fields = ['id', 'uploaded_at', 'download_count', 'signed_by_name', 'uploaded_by_name', 'employee_name']


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


class ShiftTemplateSerializer(serializers.ModelSerializer):
    """시프트 템플릿 시리얼라이저"""
    class Meta:
        model = ShiftTemplate
        fields = [
            'id', 'name', 'start_time', 'end_time', 'break_minutes',
            'color', 'is_active', 'sort_order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


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
            'shift_name', 'shift_color', 'shift_template',
            'break_minutes', 'is_confirmed', 'hours', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'organization', 'created_at', 'updated_at', 'user_name', 'employee_id', 'hours']
        # Disable auto UniqueTogetherValidator — view handles upsert/conflict logic
        validators = []

    def get_hours(self, obj):
        return round(obj.hours, 2)


class TimesheetSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='user.employee_id', read_only=True)
    worked_hours = serializers.SerializerMethodField()
    overtime_approved_by_name = serializers.CharField(
        source='overtime_approved_by.user.get_full_name', read_only=True, default=None
    )

    class Meta:
        model = Timesheet
        fields = [
            'id', 'user', 'user_name', 'employee_id',
            'organization', 'date', 'check_in', 'check_out',
            'break_start', 'break_end', 'total_break_minutes',
            'is_overtime', 'overtime_reason', 'overtime_approved', 'overtime_approved_by_name',
            'is_approved', 'notes', 'worked_hours',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'user_name',
            'employee_id', 'worked_hours', 'overtime_approved_by_name'
        ]

    def get_worked_hours(self, obj):
        return round(obj.worked_hours, 2) if obj.worked_hours else 0


class TaskSerializer(serializers.ModelSerializer):
    """업무 할당 시리얼라이저"""
    assigned_to_name = serializers.CharField(source='assigned_to.user.get_full_name', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.user.get_full_name', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'organization', 'title', 'description',
            'assigned_to', 'assigned_to_name',
            'assigned_by', 'assigned_by_name',
            'priority', 'status', 'due_date', 'due_time',
            'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = ['id', 'organization', 'assigned_by', 'created_at', 'updated_at', 'completed_at',
                            'assigned_to_name', 'assigned_by_name']


class EmployeeInviteSerializer(serializers.ModelSerializer):
    """직원 초대 시리얼라이저"""
    invited_by_name = serializers.CharField(source='invited_by.user.get_full_name', read_only=True)
    accepted_by_name = serializers.CharField(source='accepted_by.user.get_full_name', read_only=True, allow_null=True)
    job_title_display = serializers.CharField(source='job_title', read_only=True)
    work_type_display = serializers.CharField(source='get_work_type_display', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = EmployeeInvite
        fields = [
            'id', 'invite_code', 'email', 'first_name', 'last_name',
            'role', 'job_title', 'job_title_display', 'work_type', 'work_type_display',
            'hourly_rate',
            'commencement_date', 'work_location', 'min_hours', 'max_hours', 'reporting_to',
            'status', 'is_expired',
            'invited_by', 'invited_by_name', 'accepted_by', 'accepted_by_name',
            'created_at', 'expires_at',
        ]
        read_only_fields = [
            'id', 'invite_code', 'status', 'invited_by', 'accepted_by',
            'created_at', 'expires_at', 'is_expired',
        ]


class DocumentTemplateSerializer(serializers.ModelSerializer):
    """문서 템플릿 시리얼라이저"""
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    work_type_display = serializers.CharField(source='get_work_type_display', read_only=True)
    job_title_display = serializers.CharField(source='job_title', read_only=True)

    class Meta:
        model = DocumentTemplate
        fields = [
            'id', 'document_type', 'document_type_display',
            'work_type', 'work_type_display',
            'job_title', 'job_title_display',
            'title', 'file',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class IR330DeclarationSerializer(serializers.ModelSerializer):
    """IR330 Tax Declaration 시리얼라이저"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    tax_code_display = serializers.CharField(source='get_tax_code_display', read_only=True)

    class Meta:
        model = IR330Declaration
        fields = [
            'id', 'employee', 'employee_name', 'onboarding',
            'ird_number', 'tax_code', 'tax_code_display',
            'is_nz_resident', 'has_student_loan',
            'signature',
            'signed_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'employee_name', 'employee', 'signature']


class TrainingModuleSerializer(serializers.ModelSerializer):
    """교육 모듈 시리얼라이저"""
    module_type_display = serializers.CharField(source='get_module_type_display', read_only=True)

    class Meta:
        model = TrainingModule
        fields = [
            'id', 'module_type', 'module_type_display', 'title', 'description',
            'file', 'video_url', 'is_active', 'sort_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TeamMemberListSerializer(serializers.Serializer):
    """팀 멤버 목록 시리얼라이저"""
    id = serializers.IntegerField(source='profile_id')
    user_id = serializers.IntegerField()
    name = serializers.CharField()
    employee_id = serializers.CharField()
    role = serializers.CharField()
    role_display = serializers.CharField()
    job_title = serializers.CharField(allow_null=True)
    job_title_display = serializers.CharField(allow_null=True)
    work_type = serializers.CharField()
    work_type_display = serializers.CharField()
    employment_status = serializers.CharField()
    date_of_joining = serializers.DateField()
    phone = serializers.CharField(allow_null=True)
    hourly_rate = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)


class TeamMemberDetailSerializer(serializers.Serializer):
    """팀 멤버 상세 시리얼라이저"""
    id = serializers.IntegerField()
    user_id = serializers.IntegerField()
    name = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField()
    employee_id = serializers.CharField()
    role = serializers.CharField()
    role_display = serializers.CharField()
    job_title = serializers.CharField(allow_null=True)
    job_title_display = serializers.CharField(allow_null=True)
    work_type = serializers.CharField()
    work_type_display = serializers.CharField()
    employment_status = serializers.CharField()
    date_of_joining = serializers.DateField()
    date_of_birth = serializers.DateField(allow_null=True)
    phone = serializers.CharField(allow_null=True)
    kiwisaver_status = serializers.CharField()
    kiwisaver_rate = serializers.CharField(allow_null=True)
    hourly_rate = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    salary_history = serializers.ListField(child=serializers.DictField())
    documents = EmployeeDocumentSerializer(many=True)
    onboarding_status = serializers.CharField(allow_null=True)


class InquirySerializer(serializers.ModelSerializer):
    """직원 문의 시리얼라이저"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    replied_by_name = serializers.CharField(source='replied_by.user.get_full_name', read_only=True, allow_null=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Inquiry
        fields = [
            'id', 'employee', 'employee_name', 'organization',
            'category', 'category_display', 'subject', 'message',
            'status', 'status_display',
            'reply', 'replied_by', 'replied_by_name', 'replied_at',
            'created_at',
        ]
        read_only_fields = [
            'id', 'employee', 'employee_name', 'organization',
            'status', 'status_display', 'category_display',
            'reply', 'replied_by', 'replied_by_name', 'replied_at', 'created_at',
        ]


class ResignationRequestSerializer(serializers.ModelSerializer):
    """퇴직 신청 시리얼라이저"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.user.get_full_name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    work_type = serializers.CharField(source='employee.work_type', read_only=True)
    work_type_display = serializers.CharField(source='employee.get_work_type_display', read_only=True)

    class Meta:
        model = ResignationRequest
        fields = [
            'id', 'employee', 'employee_name', 'organization',
            'reason', 'requested_last_day',
            'notice_period_weeks', 'earliest_last_day',
            'confirmed_last_day',
            'status', 'status_display',
            'manager_notes', 'confirmed_by', 'confirmed_by_name', 'confirmed_at',
            'work_type', 'work_type_display',
            'created_at',
        ]
        read_only_fields = [
            'id', 'employee', 'employee_name', 'organization',
            'notice_period_weeks', 'earliest_last_day',
            'status', 'status_display',
            'manager_notes', 'confirmed_by', 'confirmed_by_name', 'confirmed_at',
            'work_type', 'work_type_display',
            'created_at',
        ]


class DisciplinaryRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.user.get_full_name', read_only=True, allow_null=True)
    record_type_display = serializers.CharField(source='get_record_type_display', read_only=True)

    class Meta:
        model = DisciplinaryRecord
        fields = [
            'id', 'employee', 'employee_name', 'organization',
            'record_type', 'record_type_display', 'date', 'subject', 'description',
            'outcome', 'witness', 'follow_up_date',
            'acknowledged_by_employee', 'acknowledged_at',
            'file', 'issued_by', 'issued_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'issued_by', 'created_at', 'updated_at']


class PerformanceReviewSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    reviewer_name = serializers.CharField(source='reviewer.user.get_full_name', read_only=True, allow_null=True)
    overall_rating_display = serializers.CharField(source='get_overall_rating_display', read_only=True)

    class Meta:
        model = PerformanceReview
        fields = [
            'id', 'employee', 'employee_name', 'organization',
            'reviewer', 'reviewer_name',
            'review_period_start', 'review_period_end', 'overall_rating', 'overall_rating_display',
            'strengths', 'areas_for_improvement', 'goals', 'employee_comments',
            'acknowledged_by_employee', 'acknowledged_at',
            'file', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'reviewer', 'created_at', 'updated_at']


class WorkplaceAccidentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    reported_by_name = serializers.CharField(source='reported_by.user.get_full_name', read_only=True, allow_null=True)
    injury_type_display = serializers.CharField(source='get_injury_type_display', read_only=True)

    class Meta:
        model = WorkplaceAccident
        fields = [
            'id', 'employee', 'employee_name', 'organization',
            'date', 'time', 'location', 'description',
            'injury_type', 'injury_type_display', 'body_part_affected',
            'first_aid_given', 'first_aid_details',
            'medical_treatment_sought', 'days_off_work',
            'worksafe_notified', 'worksafe_reference',
            'corrective_actions', 'reported_by', 'reported_by_name',
            'witness_names', 'file',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'reported_by', 'created_at', 'updated_at']


class EmployeeNoteSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True, allow_null=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = EmployeeNote
        fields = [
            'id', 'employee', 'employee_name', 'organization',
            'category', 'category_display', 'date', 'subject', 'content',
            'is_confidential', 'created_by', 'created_by_name',
            'file', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'created_by', 'created_at', 'updated_at']
