from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta, date, datetime
from django.db.models import Q, Count
from collections import defaultdict

from .models import (
    TemperatureLocation, CleaningArea,
    SafetyChecklistTemplate, DailyChecklistResponse,
    CleaningRecord, TemperatureRecord, TrainingRecord,
    SelfVerificationRecord, Incident, AuditLog,
    SafetyRecordType, StoreRecordConfig, SafetyRecord
)
from .serializers import (
    TemperatureLocationSerializer, CleaningAreaSerializer,
    SafetyChecklistTemplateSerializer, DailyChecklistResponseSerializer,
    CleaningRecordSerializer, TemperatureRecordSerializer, TrainingRecordSerializer,
    SelfVerificationSerializer, IncidentSerializer, AuditLogSerializer,
    SafetyComplianceSummarySerializer,
    SafetyRecordTypeSerializer, StoreRecordConfigSerializer,
    SafetyRecordSerializer, SafetyRecordQuickCompleteSerializer
)
from users.permissions import IsManager, IsSeniorManager
from users.filters import OrganizationFilterBackend


def _get_target_org(request):
    """CEO/HQ가 store_id로 특정 매장 선택 시 해당 매장 반환"""
    from users.models import Organization
    store_id = request.query_params.get('store_id')
    if store_id and request.user.profile.role in ['CEO', 'HQ', 'REGIONAL_MANAGER', 'SENIOR_MANAGER']:
        try:
            return Organization.objects.get(id=store_id)
        except Organization.DoesNotExist:
            pass
    return request.user.profile.organization


class TemperatureLocationViewSet(viewsets.ModelViewSet):
    """온도 체크 위치 관리 ViewSet (Store Settings에서 사용)"""
    queryset = TemperatureLocation.objects.all()
    serializer_class = TemperatureLocationSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(organization=_get_target_org(self.request))


class CleaningAreaViewSet(viewsets.ModelViewSet):
    """Cleaning Area management ViewSet (Store Settings)"""
    queryset = CleaningArea.objects.all()
    serializer_class = CleaningAreaSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(organization=_get_target_org(self.request))


class SafetyChecklistTemplateViewSet(viewsets.ModelViewSet):
    """안전 체크리스트 템플릿 ViewSet"""
    serializer_class = SafetyChecklistTemplateSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['-created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """사용자의 조직의 템플릿만 조회"""
        user = self.request.user
        user_profile = user.profile
        return SafetyChecklistTemplate.objects.filter(
            organization=user_profile.organization,
            is_active=True
        )

    def perform_create(self, serializer):
        """템플릿 생성 시 organization과 created_by 자동 설정"""
        user_profile = self.request.user.profile
        serializer.save(
            organization=user_profile.organization,
            created_by=user_profile
        )


class DailyChecklistResponseViewSet(viewsets.ModelViewSet):
    """일일 체크리스트 응답 ViewSet"""
    serializer_class = DailyChecklistResponseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['-date']
    ordering = ['-date']

    def get_queryset(self):
        """사용자의 조직의 체크리스트만 조회"""
        user = self.request.user
        user_profile = user.profile

        # Manager 이상: 모든 직원의 체크리스트 조회
        # Employee: 자신의 체크리스트만 조회
        if user_profile.role in ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']:
            return DailyChecklistResponse.objects.filter(
                organization=user_profile.organization
            )
        else:
            return DailyChecklistResponse.objects.filter(
                organization=user_profile.organization,
                completed_by=user_profile
            )

    def perform_create(self, serializer):
        """체크리스트 응답 생성"""
        user_profile = self.request.user.profile
        serializer.save(
            organization=user_profile.organization,
            completed_by=user_profile
        )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """체크리스트 완료 처리"""
        checklist = self.get_object()
        checklist.is_completed = True
        checklist.completed_at = timezone.now()
        checklist.save()
        return Response({'status': '체크리스트 완료됨'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """오늘의 체크리스트 조회"""
        user = request.user
        user_profile = user.profile
        today = date.today()

        checklists = self.get_queryset().filter(date=today)
        serializer = self.get_serializer(checklists, many=True)
        return Response(serializer.data)


class TemperatureLogViewSet(viewsets.ModelViewSet):
    """온도 기록 ViewSet"""
    serializer_class = TemperatureRecordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['-date', '-time']
    ordering = ['-date', '-time']

    def get_queryset(self):
        """사용자의 조직의 온도 기록만 조회"""
        return TemperatureRecord.objects.filter(
            organization=self._resolve_org()
        )

    def _resolve_org(self):
        profile = self.request.user.profile
        if profile.role in ['CEO', 'HQ', 'REGIONAL_MANAGER', 'SENIOR_MANAGER']:
            store_id = self.request.query_params.get('store_id')
            if store_id:
                from users.models import Organization
                try:
                    return Organization.objects.get(id=store_id)
                except Organization.DoesNotExist:
                    pass
        return profile.organization

    def perform_create(self, serializer):
        """온도 기록 생성"""
        user_profile = self.request.user.profile
        serializer.save(
            organization=self._resolve_org(),
            recorded_by=user_profile
        )

    @action(detail=False, methods=['get'])
    def latest(self, request):
        """가장 최근 온도 기록 조회 (위치별)"""
        user = request.user
        user_profile = user.profile
        today = date.today()

        # 각 위치별 최신 기록
        latest_records = []
        locations = TemperatureRecord.objects.filter(
            organization=user_profile.organization,
            date=today
        ).values_list('location', flat=True).distinct()

        for location in locations:
            record = TemperatureRecord.objects.filter(
                organization=user_profile.organization,
                location=location,
                date=today
            ).order_by('-time').first()
            if record:
                latest_records.append(record)

        serializer = self.get_serializer(latest_records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def alerts(self, request):
        """비정상 온도 기록만 조회"""
        user = request.user
        user_profile = user.profile
        today = date.today()

        # 비정상 온도 필터링 (±2도 이상)
        records = TemperatureRecord.objects.filter(
            organization=user_profile.organization,
            date=today
        )

        alert_records = []
        for record in records:
            if record.standard_temperature is not None:
                if abs(record.temperature - record.standard_temperature) > 2.0:
                    alert_records.append(record)

        serializer = self.get_serializer(alert_records, many=True)
        return Response(serializer.data)


class TrainingRecordViewSet(viewsets.ModelViewSet):
    """교육 기록 ViewSet"""
    serializer_class = TrainingRecordSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['-date']
    ordering = ['-date']

    def get_queryset(self):
        """사용자의 조직의 교육 기록만 조회"""
        user = self.request.user
        user_profile = user.profile
        return TrainingRecord.objects.filter(
            organization=user_profile.organization
        )

    def perform_create(self, serializer):
        """교육 기록 생성"""
        user_profile = self.request.user.profile
        serializer.save(
            organization=user_profile.organization,
            created_by=user_profile
        )

    @action(detail=False, methods=['get'])
    def upcoming_expiry(self, request):
        """30일 내 만료 예정 교육 조회"""
        user = request.user
        user_profile = user.profile
        thirty_days_later = date.today() + timedelta(days=30)

        trainings = TrainingRecord.objects.filter(
            organization=user_profile.organization,
            expiry_date__lte=thirty_days_later,
            expiry_date__gte=date.today()
        ).order_by('expiry_date')

        serializer = self.get_serializer(trainings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def staff_status(self, request):
        """직원별 교육 이수 현황"""
        user = request.user
        user_profile = user.profile

        trainings = TrainingRecord.objects.filter(
            organization=user_profile.organization
        ).prefetch_related('participants')

        data = []
        for training in trainings:
            data.append({
                'id': training.id,
                'title': training.title,
                'date': training.date,
                'expiry_date': training.expiry_date,
                'total_staff': user_profile.organization.staff.count(),
                'participants': training.participants.count(),
                'completion_rate': int((training.participants.count() / user_profile.organization.staff.count() * 100)) if user_profile.organization.staff.count() > 0 else 0,
            })

        return Response(data)


class CleaningRecordViewSet(viewsets.ModelViewSet):
    """청소 기록 ViewSet"""
    serializer_class = CleaningRecordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['-date']
    ordering = ['-date']

    def get_queryset(self):
        """사용자의 조직의 청소 기록만 조회"""
        user = self.request.user
        user_profile = user.profile
        return CleaningRecord.objects.filter(
            organization=user_profile.organization
        )

    def perform_create(self, serializer):
        """청소 기록 생성"""
        user_profile = self.request.user.profile
        serializer.save(
            organization=user_profile.organization,
            cleaned_by=user_profile
        )

    @action(detail=False, methods=['get'])
    def today(self, request):
        """오늘의 청소 기록"""
        user = request.user
        user_profile = user.profile
        today = date.today()

        records = self.get_queryset().filter(date=today)
        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def schedule(self, request):
        """주간 청소 일정"""
        user = request.user
        user_profile = user.profile
        today = date.today()
        week_later = today + timedelta(days=7)

        records = CleaningRecord.objects.filter(
            organization=user_profile.organization,
            date__range=[today, week_later]
        ).order_by('date', 'area')

        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)


class SelfVerificationViewSet(viewsets.ModelViewSet):
    """자체 검증 기록 ViewSet"""
    serializer_class = SelfVerificationSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['-period_end']
    ordering = ['-period_end']

    def get_queryset(self):
        """사용자의 조직의 검증 기록만 조회"""
        user = self.request.user
        user_profile = user.profile
        return SelfVerificationRecord.objects.filter(
            organization=user_profile.organization
        )

    def perform_create(self, serializer):
        """검증 기록 생성"""
        user_profile = self.request.user.profile
        serializer.save(
            organization=user_profile.organization,
            verified_by=user_profile,
            verified_at=timezone.now()
        )

    @action(detail=True, methods=['post'])
    def mark_verified(self, request, pk=None):
        """검증 완료 처리"""
        verification = self.get_object()
        verification.verified_by = request.user.profile
        verification.verified_at = timezone.now()
        verification.save()
        return Response({'status': '검증 완료됨'}, status=status.HTTP_200_OK)


class IncidentViewSet(viewsets.ModelViewSet):
    """사건/불만 기록 ViewSet"""
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['-reported_at']
    ordering = ['-reported_at']

    def get_queryset(self):
        """사용자의 조직의 사건 기록만 조회"""
        user = self.request.user
        user_profile = user.profile
        return Incident.objects.filter(
            organization=user_profile.organization
        )

    def perform_create(self, serializer):
        """사건 보고"""
        user_profile = self.request.user.profile
        serializer.save(
            organization=user_profile.organization,
            reported_by=user_profile
        )

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """사건 해결 처리"""
        incident = self.get_object()
        incident.status = 'resolved'
        incident.resolved_by = request.user.profile
        incident.resolved_at = timezone.now()
        incident.resolution_notes = request.data.get('resolution_notes', '')
        incident.save()
        return Response({'status': '사건 해결됨'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def open_incidents(self, request):
        """미해결 사건 조회"""
        user = request.user
        user_profile = user.profile

        incidents = Incident.objects.filter(
            organization=user_profile.organization,
            status__in=['reported', 'investigating']
        ).order_by('-reported_at')

        serializer = self.get_serializer(incidents, many=True)
        return Response(serializer.data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """감사 기록 ViewSet (읽기 전용)"""
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['-date']
    ordering = ['-date']

    def get_queryset(self):
        """사용자의 조직의 감사 기록만 조회"""
        user = self.request.user
        user_profile = user.profile
        return AuditLog.objects.filter(
            organization=user_profile.organization
        )


class SafetyComplianceDashboardViewSet(viewsets.ViewSet):
    """규정 준수 대시보드 ViewSet (조회 전용)"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def today_summary(self, request):
        """오늘의 안전 요약"""
        user = request.user
        user_profile = user.profile
        today = date.today()

        # 오늘의 체크리스트
        today_checklists = DailyChecklistResponse.objects.filter(
            organization=user_profile.organization,
            date=today
        )

        # 완료 현황
        completed_count = today_checklists.filter(is_completed=True).count()
        total_count = today_checklists.count()
        completion_rate = int((completed_count / total_count * 100)) if total_count > 0 else 0

        # 미해결 사건
        open_incidents = Incident.objects.filter(
            organization=user_profile.organization,
            status__in=['reported', 'investigating']
        ).count()

        # 온도 경고
        temperature_alerts = 0
        temp_records = TemperatureRecord.objects.filter(
            organization=user_profile.organization,
            date=today
        )
        for record in temp_records:
            if record.standard_temperature and abs(record.temperature - record.standard_temperature) > 2.0:
                temperature_alerts += 1

        return Response({
            'completion_rate': completion_rate,
            'completed_checklists': completed_count,
            'total_checklists': total_count,
            'open_incidents': open_incidents,
            'temperature_alerts': temperature_alerts,
        })

    @action(detail=False, methods=['get'])
    def weekly_summary(self, request):
        """주간 안전 요약"""
        user = request.user
        user_profile = user.profile
        today = date.today()
        week_ago = today - timedelta(days=7)

        # 주간 체크리스트 완료율
        weekly_checklists = DailyChecklistResponse.objects.filter(
            organization=user_profile.organization,
            date__range=[week_ago, today]
        )
        completed_count = weekly_checklists.filter(is_completed=True).count()
        total_count = weekly_checklists.count()
        completion_rate = int((completed_count / total_count * 100)) if total_count > 0 else 0

        # 주간 사건 건수
        incidents_count = Incident.objects.filter(
            organization=user_profile.organization,
            reported_at__range=[week_ago, today]
        ).count()

        # 주간 교육 이수
        training_count = TrainingRecord.objects.filter(
            organization=user_profile.organization,
            date__range=[week_ago, today]
        ).count()

        return Response({
            'completion_rate': completion_rate,
            'completed_checklists': completed_count,
            'total_checklists': total_count,
            'incidents': incidents_count,
            'trainings': training_count,
        })

    @action(detail=False, methods=['get'])
    def compliance_status(self, request):
        """규정 준수 현황"""
        user = request.user
        user_profile = user.profile
        today = date.today()

        # 최신 자체 검증
        latest_verification = SelfVerificationRecord.objects.filter(
            organization=user_profile.organization
        ).order_by('-period_end').first()

        verification_data = {}
        if latest_verification:
            if latest_verification.responses:
                compliant = sum(1 for v in latest_verification.responses.values() if v is True)
                total = len(latest_verification.responses)
                verification_data = {
                    'compliance_score': int((compliant / total * 100)) if total > 0 else 0,
                    'period': f"{latest_verification.period_start} to {latest_verification.period_end}",
                }

        # 만료 예정 교육
        thirty_days_later = today + timedelta(days=30)
        upcoming_trainings = TrainingRecord.objects.filter(
            organization=user_profile.organization,
            expiry_date__lte=thirty_days_later,
            expiry_date__gte=today
        ).count()

        # 미해결 사건
        open_incidents = Incident.objects.filter(
            organization=user_profile.organization,
            status__in=['reported', 'investigating']
        ).count()

        return Response({
            'verification': verification_data,
            'upcoming_training_expirations': upcoming_trainings,
            'open_incidents': open_incidents,
        })


# ============================================================
# MPI Food Safety Record System ViewSets
# ============================================================

class SafetyRecordTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """MPI 기록 유형 카탈로그 ViewSet (읽기 전용, 모든 인증 유저)"""
    serializer_class = SafetyRecordTypeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        queryset = SafetyRecordType.objects.filter(is_active=True)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        return queryset


class StoreRecordConfigViewSet(viewsets.ModelViewSet):
    """매장별 기록 설정 ViewSet (매니저만)"""
    serializer_class = StoreRecordConfigSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def get_queryset(self):
        return StoreRecordConfig.objects.filter(
            organization=self.request.user.profile.organization
        ).select_related('record_type')

    @action(detail=False, methods=['post'])
    def initialize(self, request):
        """모든 시스템 기록 유형을 매장에 초기화
        Daily/Weekly/Monthly/Event → enabled, Specialist → disabled
        """
        org = request.user.profile.organization
        record_types = SafetyRecordType.objects.filter(is_active=True)
        created_count = 0

        for rt in record_types:
            _, created = StoreRecordConfig.objects.get_or_create(
                organization=org,
                record_type=rt,
                defaults={
                    'is_enabled': rt.category != 'SPECIALIST',
                    'assigned_role': 'MANAGER' if rt.category in ['MONTHLY', 'SETUP'] else 'EMPLOYEE' if rt.category == 'DAILY' else 'BOTH',
                }
            )
            if created:
                created_count += 1

        configs = StoreRecordConfig.objects.filter(
            organization=org
        ).select_related('record_type')
        serializer = self.get_serializer(configs, many=True)
        return Response({
            'created': created_count,
            'configs': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """개별 기록 유형 on/off 토글"""
        config = self.get_object()
        config.is_enabled = not config.is_enabled
        config.save()
        serializer = self.get_serializer(config)
        return Response(serializer.data)


class SafetyRecordViewSet(viewsets.ModelViewSet):
    """식품안전 기록 ViewSet (통합)"""
    serializer_class = SafetyRecordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-date', '-time', '-created_at']

    def get_queryset(self):
        user_profile = self.request.user.profile
        queryset = SafetyRecord.objects.filter(
            organization=user_profile.organization
        ).select_related('record_type', 'completed_by__user', 'reviewed_by__user')

        # 필터 파라미터
        record_type = self.request.query_params.get('record_type')
        category = self.request.query_params.get('category')
        record_status = self.request.query_params.get('status')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if record_type:
            queryset = queryset.filter(record_type__code=record_type)
        if category:
            queryset = queryset.filter(record_type__category=category)
        if record_status:
            queryset = queryset.filter(status=record_status)
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset

    def perform_create(self, serializer):
        user_profile = self.request.user.profile
        serializer.save(
            organization=user_profile.organization,
            completed_by=user_profile
        )

    @action(detail=False, methods=['get'])
    def today_tasks(self, request):
        """오늘 해야 할 데일리 태스크 + 완료 상태 (직원 대시보드용)"""
        user_profile = request.user.profile
        org = user_profile.organization
        # CEO/HQ can use store_id param
        if user_profile.role in ['CEO', 'HQ', 'REGIONAL_MANAGER', 'SENIOR_MANAGER']:
            store_id = request.query_params.get('store_id')
            if store_id:
                from users.models import Organization
                try:
                    org = Organization.objects.get(id=store_id)
                except Organization.DoesNotExist:
                    pass
        today = date.today()
        current_weekday = today.weekday()  # 0=Mon, 6=Sun

        # 매장에 활성화된 기록 유형 조회
        configs = StoreRecordConfig.objects.filter(
            organization=org,
            is_enabled=True
        ).select_related('record_type')

        # 역할 기반 필터 (직원이면 EMPLOYEE/BOTH만, 매니저면 전부)
        is_manager = user_profile.role in ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']
        if not is_manager:
            # 직원 권한 체크: can_safety_tasks=False이면 빈 목록
            if not user_profile.can_safety_tasks:
                return Response([])
            configs = configs.filter(assigned_role__in=['EMPLOYEE', 'BOTH'])

        # 오늘 날짜 기준으로 보여줄 태스크 결정
        tasks = []
        for config in configs:
            rt = config.record_type
            show_today = False

            if rt.frequency == 'DAILY':
                show_today = True
            elif rt.frequency == 'WEEKLY' and current_weekday == 0:  # 월요일
                show_today = True
            elif rt.frequency == 'MONTHLY' and today.day == 1:  # 매월 1일
                show_today = True
            # EVENT, ONE_TIME은 데일리 태스크에 표시 안 함

            if not show_today:
                continue

            # 오늘 이 기록 유형의 완료된 레코드 조회
            existing = SafetyRecord.objects.filter(
                organization=org,
                record_type=rt,
                date=today
            ).select_related('completed_by__user').order_by('-created_at').first()

            task_data = {
                'record_type': SafetyRecordTypeSerializer(rt).data,
                'config': StoreRecordConfigSerializer(config).data,
                'is_completed': existing is not None and existing.status in ['COMPLETED', 'REVIEWED'],
                'record': SafetyRecordSerializer(existing).data if existing else None,
            }
            tasks.append(task_data)

        return Response(tasks)

    @action(detail=False, methods=['post'])
    def quick_complete(self, request):
        """원탭 완료 — 폼 데이터와 함께 COMPLETED 상태로 즉시 생성"""
        serializer = SafetyRecordQuickCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_profile = request.user.profile
        record_type = serializer.validated_data['record_type']

        # Resolve organization: CEO/HQ can use store_id param
        org = user_profile.organization
        if user_profile.role in ['CEO', 'HQ', 'REGIONAL_MANAGER', 'SENIOR_MANAGER']:
            store_id = request.query_params.get('store_id')
            if store_id:
                from users.models import Organization
                try:
                    org = Organization.objects.get(id=store_id)
                except Organization.DoesNotExist:
                    pass

        record = SafetyRecord.objects.create(
            organization=org,
            record_type=record_type,
            date=date.today(),
            time=datetime.now().time(),
            completed_by=user_profile,
            data=serializer.validated_data.get('data', {}),
            notes=serializer.validated_data.get('notes', ''),
            status='COMPLETED'
        )

        return Response(
            SafetyRecordSerializer(record).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """매니저가 기록 검토 (REVIEWED 상태로 전환)"""
        record = self.get_object()
        user_profile = request.user.profile

        # 매니저 권한 확인
        if user_profile.role not in ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']:
            return Response(
                {'error': '매니저만 검토할 수 있습니다.'},
                status=status.HTTP_403_FORBIDDEN
            )

        record.reviewed_by = user_profile
        record.reviewed_at = timezone.now()
        record.review_notes = request.data.get('review_notes', '')
        record.status = 'REVIEWED'
        record.save()

        serializer = self.get_serializer(record)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def inspection_report(self, request):
        """인스펙션 보고서 — 카테고리→기록유형→날짜순 그룹핑"""
        user_profile = request.user.profile
        org = user_profile.organization

        # 날짜 범위 (기본: 최근 30일)
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if not date_from:
            date_from = (date.today() - timedelta(days=30)).isoformat()
        if not date_to:
            date_to = date.today().isoformat()

        category_filter = request.query_params.get('category')
        status_filter = request.query_params.get('status')

        records = SafetyRecord.objects.filter(
            organization=org,
            date__gte=date_from,
            date__lte=date_to,
        ).select_related(
            'record_type', 'completed_by__user', 'reviewed_by__user'
        ).order_by('record_type__category', 'record_type__sort_order', '-date', '-time')

        if category_filter:
            records = records.filter(record_type__category=category_filter)
        if status_filter:
            records = records.filter(status=status_filter)

        # 카테고리 → 기록유형 → 기록 리스트 그룹핑
        grouped = defaultdict(lambda: defaultdict(list))
        type_info = {}

        for record in records:
            cat = record.record_type.category
            code = record.record_type.code
            grouped[cat][code].append(SafetyRecordSerializer(record).data)
            if code not in type_info:
                type_info[code] = SafetyRecordTypeSerializer(record.record_type).data

        # 날짜 범위 내 전체 일수 (규정준수율 계산용)
        from_date = date.fromisoformat(date_from)
        to_date = date.fromisoformat(date_to)
        total_days = (to_date - from_date).days + 1

        result = []
        category_order = ['DAILY', 'WEEKLY', 'MONTHLY', 'EVENT', 'SETUP', 'SPECIALIST']
        for cat in category_order:
            if cat not in grouped:
                continue
            cat_data = {
                'category': cat,
                'record_types': []
            }
            for code, record_list in grouped[cat].items():
                unique_dates = len(set(r['date'] for r in record_list))
                cat_data['record_types'].append({
                    'record_type': type_info[code],
                    'records': record_list,
                    'total_records': len(record_list),
                    'unique_dates': unique_dates,
                    'total_days': total_days,
                    'compliance_rate': int(unique_dates / total_days * 100) if total_days > 0 else 0,
                })
            result.append(cat_data)

        return Response({
            'date_from': date_from,
            'date_to': date_to,
            'total_days': total_days,
            'categories': result,
        })

    @action(detail=False, methods=['get'])
    def weekly_summary(self, request):
        """주간 규정준수 요약"""
        user_profile = request.user.profile
        org = user_profile.organization
        today = date.today()
        week_ago = today - timedelta(days=7)

        records = SafetyRecord.objects.filter(
            organization=org,
            date__gte=week_ago,
            date__lte=today,
        )

        total = records.count()
        completed = records.filter(status__in=['COMPLETED', 'REVIEWED']).count()
        flagged = records.filter(status='FLAGGED').count()
        reviewed = records.filter(status='REVIEWED').count()

        # 기록 유형별 요약
        type_summary = records.values(
            'record_type__code', 'record_type__name', 'record_type__name_ko'
        ).annotate(
            total=Count('id'),
            completed_count=Count('id', filter=Q(status__in=['COMPLETED', 'REVIEWED'])),
        ).order_by('record_type__code')

        return Response({
            'period': {'from': week_ago.isoformat(), 'to': today.isoformat()},
            'total_records': total,
            'completed': completed,
            'flagged': flagged,
            'reviewed': reviewed,
            'completion_rate': int(completed / total * 100) if total > 0 else 0,
            'by_record_type': list(type_summary),
        })
