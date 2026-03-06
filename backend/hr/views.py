from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta

from .models import Onboarding, OnboardingTask, EmployeeDocument, Roster, Timesheet
from .serializers import (
    OnboardingDetailSerializer, OnboardingListSerializer,
    OnboardingTaskSerializer, EmployeeDocumentSerializer,
    RosterSerializer, TimesheetSerializer
)
from users.permissions import IsManager
from users.filters import OrganizationFilterBackend


class OnboardingViewSet(viewsets.ModelViewSet):
    """
    온보딩 프로세스 관리 ViewSet
    - list: 온보딩 목록
    - create: 신규 온보딩 생성
    - retrieve: 온보딩 상세 조회
    - update/partial_update: 온보딩 수정
    - destroy: 온보딩 삭제
    - complete: 온보딩 완료
    """
    queryset = Onboarding.objects.all()
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return OnboardingDetailSerializer
        return OnboardingListSerializer

    def get_queryset(self):
        """사용자의 조직에 해당하는 온보딩만 조회"""
        queryset = super().get_queryset()
        return queryset.select_related('employee__user', 'assigned_to__user', 'organization')

    def perform_create(self, serializer):
        """온보딩 생성 시 자동으로 현재 사용자 할당"""
        serializer.save()

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """온보딩 완료 표시"""
        onboarding = self.get_object()

        if not onboarding.all_tasks_completed:
            return Response(
                {'error': '모든 작업을 완료한 후 온보딩을 완료할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        onboarding.status = 'COMPLETED'
        onboarding.completed_percentage = 100
        onboarding.completed_at = timezone.now()
        onboarding.save()

        return Response(
            {'message': '온보딩이 완료되었습니다.'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """온보딩 진행률 조회"""
        onboarding = self.get_object()
        total_tasks = onboarding.tasks.count()
        completed_tasks = onboarding.tasks.filter(is_completed=True).count()

        percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

        return Response({
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'percentage': int(percentage),
            'status': onboarding.status
        }, status=status.HTTP_200_OK)


class OnboardingTaskViewSet(viewsets.ModelViewSet):
    """
    온보딩 작업 항목 관리 ViewSet
    - list: 작업 목록
    - create: 신규 작업 생성
    - update/partial_update: 작업 수정
    - destroy: 작업 삭제
    - complete: 작업 완료 표시
    """
    queryset = OnboardingTask.objects.all()
    serializer_class = OnboardingTaskSerializer
    permission_classes = [IsAuthenticated, IsManager]

    def get_queryset(self):
        """쿼리 파라미터로 온보딩 필터링"""
        queryset = super().get_queryset()
        onboarding_id = self.request.query_params.get('onboarding_id')

        if onboarding_id:
            queryset = queryset.filter(onboarding_id=onboarding_id)

        return queryset.select_related('assigned_to__user', 'onboarding__employee__user')

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """작업 완료 표시"""
        task = self.get_object()
        task.is_completed = True
        task.completed_at = timezone.now()
        task.save()

        # 온보딩 진행률 업데이트
        onboarding = task.onboarding
        total_tasks = onboarding.tasks.count()
        completed_tasks = onboarding.tasks.filter(is_completed=True).count()
        onboarding.completed_percentage = int(completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        onboarding.save()

        return Response(
            {'message': '작업이 완료되었습니다.'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def incomplete(self, request, pk=None):
        """작업 완료 취소"""
        task = self.get_object()
        task.is_completed = False
        task.completed_at = None
        task.save()

        # 온보딩 진행률 업데이트
        onboarding = task.onboarding
        total_tasks = onboarding.tasks.count()
        completed_tasks = onboarding.tasks.filter(is_completed=True).count()
        onboarding.completed_percentage = int(completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        onboarding.save()

        return Response(
            {'message': '작업 완료가 취소되었습니다.'},
            status=status.HTTP_200_OK
        )


class EmployeeDocumentViewSet(viewsets.ModelViewSet):
    """
    직원 문서 관리 ViewSet
    - list: 문서 목록
    - create: 신규 문서 업로드
    - retrieve: 문서 상세 조회
    - destroy: 문서 삭제
    - sign: 문서 서명
    - download: 문서 다운로드
    """
    queryset = EmployeeDocument.objects.all()
    serializer_class = EmployeeDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """쿼리 파라미터로 온보딩 필터링"""
        queryset = super().get_queryset()
        onboarding_id = self.request.query_params.get('onboarding_id')

        if onboarding_id:
            queryset = queryset.filter(onboarding_id=onboarding_id)

        return queryset.select_related('signed_by__user', 'uploaded_by__user', 'onboarding__employee__user')

    def perform_create(self, serializer):
        """문서 업로드 시 업로드 사용자 자동 할당"""
        serializer.save(uploaded_by=self.request.user.profile)

    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """문서 서명"""
        document = self.get_object()

        if document.is_signed:
            return Response(
                {'error': '이미 서명된 문서입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        document.is_signed = True
        document.signed_at = timezone.now()
        document.signed_by = request.user.profile
        document.save()

        return Response(
            {'message': '문서가 서명되었습니다.'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def download(self, request, pk=None):
        """문서 다운로드 기록"""
        document = self.get_object()
        document.download_count += 1
        document.save()

        return Response({
            'file_url': document.file.url,
            'download_count': document.download_count
        }, status=status.HTTP_200_OK)


class RosterViewSet(viewsets.ModelViewSet):
    """
    근무 스케줄 관리 ViewSet
    - list: 스케줄 목록
    - create: 신규 스케줄 생성
    - retrieve: 스케줄 상세 조회
    - update/partial_update: 스케줄 수정
    - destroy: 스케줄 삭제
    - weekly: 주간 스케줄 조회
    """
    queryset = Roster.objects.all()
    serializer_class = RosterSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        """사용자의 조직에 해당하는 스케줄만 조회"""
        queryset = super().get_queryset()
        return queryset.select_related('user__user', 'organization').order_by('-date')

    @action(detail=False, methods=['get'])
    def weekly(self, request):
        """주간 스케줄 조회"""
        try:
            date_str = request.query_params.get('date')
            target_date = timezone.now().date() if not date_str else timezone.datetime.strptime(date_str, '%Y-%m-%d').date()

            # 주의 시작일 (월요일)
            week_start = target_date - timedelta(days=target_date.weekday())
            week_end = week_start + timedelta(days=6)

            rosters = self.filter_queryset(self.get_queryset()).filter(
                date__range=[week_start, week_end]
            )

            serializer = self.get_serializer(rosters, many=True)
            return Response({
                'week_start': week_start,
                'week_end': week_end,
                'rosters': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def monthly(self, request):
        """월간 스케줄 조회"""
        try:
            date_str = request.query_params.get('date')
            if date_str:
                target_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
            else:
                target_date = timezone.now().date()

            month_start = target_date.replace(day=1)
            if month_start.month == 12:
                month_end = month_start.replace(year=month_start.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1) - timedelta(days=1)

            rosters = self.filter_queryset(self.get_queryset()).filter(
                date__range=[month_start, month_end]
            )

            serializer = self.get_serializer(rosters, many=True)
            return Response({
                'month_start': month_start,
                'month_end': month_end,
                'rosters': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class TimesheetViewSet(viewsets.ModelViewSet):
    """
    타임시트 (출퇴근 기록) 관리 ViewSet
    - list: 타임시트 목록
    - create: 신규 타임시트 생성
    - retrieve: 타임시트 상세 조회
    - update/partial_update: 타임시트 수정
    - approve: 타임시트 승인
    """
    queryset = Timesheet.objects.all()
    serializer_class = TimesheetSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        """사용자의 조직에 해당하는 타임시트만 조회"""
        queryset = super().get_queryset()
        return queryset.select_related('user__user', 'organization').order_by('-date')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """타임시트 승인"""
        timesheet = self.get_object()

        if timesheet.is_approved:
            return Response(
                {'error': '이미 승인된 타임시트입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        timesheet.is_approved = True
        timesheet.save()

        return Response(
            {'message': '타임시트가 승인되었습니다.'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def weekly(self, request):
        """주간 타임시트 조회"""
        try:
            date_str = request.query_params.get('date')
            target_date = timezone.now().date() if not date_str else timezone.datetime.strptime(date_str, '%Y-%m-%d').date()

            # 주의 시작일 (월요일)
            week_start = target_date - timedelta(days=target_date.weekday())
            week_end = week_start + timedelta(days=6)

            timesheets = self.filter_queryset(self.get_queryset()).filter(
                date__range=[week_start, week_end]
            )

            serializer = self.get_serializer(timesheets, many=True)
            return Response({
                'week_start': week_start,
                'week_end': week_end,
                'timesheets': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
