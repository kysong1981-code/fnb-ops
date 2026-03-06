from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta, date
from django.db.models import Q, Count

from .models import (
    SafetyChecklistTemplate, DailyChecklistResponse,
    CleaningRecord, TemperatureRecord, TrainingRecord,
    SelfVerificationRecord, Incident, AuditLog
)
from .serializers import (
    SafetyChecklistTemplateSerializer, DailyChecklistResponseSerializer,
    CleaningRecordSerializer, TemperatureRecordSerializer, TrainingRecordSerializer,
    SelfVerificationSerializer, IncidentSerializer, AuditLogSerializer,
    SafetyComplianceSummarySerializer
)
from users.permissions import IsManager, IsSeniorManager


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
        user_profile = user.userprofile
        return SafetyChecklistTemplate.objects.filter(
            organization=user_profile.organization,
            is_active=True
        )

    def perform_create(self, serializer):
        """템플릿 생성 시 organization과 created_by 자동 설정"""
        user_profile = self.request.user.userprofile
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
        user_profile = user.userprofile

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
        user_profile = self.request.user.userprofile
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
        user_profile = user.userprofile
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
        user = self.request.user
        user_profile = user.userprofile
        return TemperatureRecord.objects.filter(
            organization=user_profile.organization
        )

    def perform_create(self, serializer):
        """온도 기록 생성"""
        user_profile = self.request.user.userprofile
        serializer.save(
            organization=user_profile.organization,
            recorded_by=user_profile
        )

    @action(detail=False, methods=['get'])
    def latest(self, request):
        """가장 최근 온도 기록 조회 (위치별)"""
        user = request.user
        user_profile = user.userprofile
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
        user_profile = user.userprofile
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
        user_profile = user.userprofile
        return TrainingRecord.objects.filter(
            organization=user_profile.organization
        )

    def perform_create(self, serializer):
        """교육 기록 생성"""
        user_profile = self.request.user.userprofile
        serializer.save(
            organization=user_profile.organization,
            created_by=user_profile
        )

    @action(detail=False, methods=['get'])
    def upcoming_expiry(self, request):
        """30일 내 만료 예정 교육 조회"""
        user = request.user
        user_profile = user.userprofile
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
        user_profile = user.userprofile

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
        user_profile = user.userprofile
        return CleaningRecord.objects.filter(
            organization=user_profile.organization
        )

    def perform_create(self, serializer):
        """청소 기록 생성"""
        user_profile = self.request.user.userprofile
        serializer.save(
            organization=user_profile.organization,
            cleaned_by=user_profile
        )

    @action(detail=False, methods=['get'])
    def today(self, request):
        """오늘의 청소 기록"""
        user = request.user
        user_profile = user.userprofile
        today = date.today()

        records = self.get_queryset().filter(date=today)
        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def schedule(self, request):
        """주간 청소 일정"""
        user = request.user
        user_profile = user.userprofile
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
        user_profile = user.userprofile
        return SelfVerificationRecord.objects.filter(
            organization=user_profile.organization
        )

    def perform_create(self, serializer):
        """검증 기록 생성"""
        user_profile = self.request.user.userprofile
        serializer.save(
            organization=user_profile.organization,
            verified_by=user_profile,
            verified_at=timezone.now()
        )

    @action(detail=True, methods=['post'])
    def mark_verified(self, request, pk=None):
        """검증 완료 처리"""
        verification = self.get_object()
        verification.verified_by = request.user.userprofile
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
        user_profile = user.userprofile
        return Incident.objects.filter(
            organization=user_profile.organization
        )

    def perform_create(self, serializer):
        """사건 보고"""
        user_profile = self.request.user.userprofile
        serializer.save(
            organization=user_profile.organization,
            reported_by=user_profile
        )

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """사건 해결 처리"""
        incident = self.get_object()
        incident.status = 'resolved'
        incident.resolved_by = request.user.userprofile
        incident.resolved_at = timezone.now()
        incident.resolution_notes = request.data.get('resolution_notes', '')
        incident.save()
        return Response({'status': '사건 해결됨'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def open_incidents(self, request):
        """미해결 사건 조회"""
        user = request.user
        user_profile = user.userprofile

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
        user_profile = user.userprofile
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
        user_profile = user.userprofile
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
        user_profile = user.userprofile
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
        user_profile = user.userprofile
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
