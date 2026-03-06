from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q

from .models import DailyClosing, ClosingHRCash, ClosingCashExpense
from .serializers import (
    DailyClosingListSerializer, DailyClosingDetailSerializer,
    ClosingHRCashSerializer, ClosingCashExpenseSerializer
)
from users.permissions import IsManager, IsSeniorManager
from users.filters import OrganizationFilterBackend


class DailyClosingViewSet(viewsets.ModelViewSet):
    """
    데일리 클로징 ViewSet
    - list: 클로징 목록 조회
    - create: 신규 클로징 생성
    - retrieve: 클로징 상세 조회
    - update/partial_update: 클로징 수정 (DRAFT만 가능)
    - destroy: 클로징 삭제 (DRAFT만 가능)
    - approve: 클로징 승인
    - reject: 클로징 거부
    """
    queryset = DailyClosing.objects.all()
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]
    parser_classes = (MultiPartParser, FormParser)

    def get_serializer_class(self):
        """액션에 따라 다른 시리얼라이저 사용"""
        if self.action == 'list':
            return DailyClosingListSerializer
        return DailyClosingDetailSerializer

    def get_queryset(self):
        """사용자의 조직에 해당하는 클로징만 조회"""
        queryset = super().get_queryset()
        # 필터 백엔드가 자동으로 필터링 수행
        return queryset.select_related('organization', 'created_by', 'approved_by')

    def create(self, request, *args, **kwargs):
        """신규 클로징 생성 (DRAFT 상태)"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        """created_by를 현재 사용자로 설정"""
        serializer.save(created_by_id=self.request.user.id, status='DRAFT')

    def update(self, request, *args, **kwargs):
        """클로징 수정 (DRAFT 상태만 가능)"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        if instance.status != 'DRAFT':
            return Response(
                {'detail': f'DRAFT 상태인 클로징만 수정할 수 있습니다. 현재 상태: {instance.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """클로징 삭제 (DRAFT 상태만 가능)"""
        instance = self.get_object()

        if instance.status != 'DRAFT':
            return Response(
                {'detail': f'DRAFT 상태인 클로징만 삭제할 수 있습니다. 현재 상태: {instance.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsSeniorManager])
    def approve(self, request, pk=None):
        """클로징 승인 (Senior Manager 이상만 가능)"""
        closing = self.get_object()

        if closing.status != 'DRAFT':
            return Response(
                {'detail': f'DRAFT 상태인 클로징만 승인할 수 있습니다. 현재 상태: {closing.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        closing.status = 'APPROVED'
        closing.approved_by_id = request.user.id
        closing.approved_at = timezone.now()
        closing.save()

        serializer = self.get_serializer(closing)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsSeniorManager])
    def reject(self, request, pk=None):
        """클로징 거부 (Senior Manager 이상만 가능)"""
        closing = self.get_object()

        if closing.status != 'DRAFT':
            return Response(
                {'detail': f'DRAFT 상태인 클로징만 거부할 수 있습니다. 현재 상태: {closing.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '')
        closing.status = 'REJECTED'
        closing.save()

        serializer = self.get_serializer(closing)
        return Response(
            {'detail': '클로징이 거부되었습니다.', 'reason': reason, **serializer.data},
            status=status.HTTP_200_OK
        )


class ClosingHRCashViewSet(mixins.CreateModelMixin,
                            mixins.ListModelMixin,
                            mixins.RetrieveModelMixin,
                            mixins.UpdateModelMixin,
                            mixins.DestroyModelMixin,
                            viewsets.GenericViewSet):
    """
    HR 현금 입력 ViewSet
    - list: HR 현금 목록 조회
    - create: HR 현금 입력
    - retrieve: HR 현금 상세 조회
    - update/partial_update: HR 현금 수정
    - destroy: HR 현금 삭제
    """
    queryset = ClosingHRCash.objects.all()
    serializer_class = ClosingHRCashSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        """사용자가 접근 가능한 HR 현금 항목 조회"""
        queryset = super().get_queryset()

        # 특정 클로징에 대한 HR 현금만 조회
        closing_id = self.request.query_params.get('closing_id')
        if closing_id:
            queryset = queryset.filter(daily_closing_id=closing_id)

        return queryset.select_related('daily_closing', 'created_by')

    def perform_create(self, serializer):
        """created_by를 현재 사용자로 설정"""
        serializer.save(created_by=self.request.user)


class ClosingCashExpenseViewSet(mixins.CreateModelMixin,
                                 mixins.ListModelMixin,
                                 mixins.RetrieveModelMixin,
                                 mixins.UpdateModelMixin,
                                 mixins.DestroyModelMixin,
                                 viewsets.GenericViewSet):
    """
    현금 지출 ViewSet (파일 업로드 지원)
    - list: 지출 목록 조회
    - create: 지출 기록 (파일 업로드 포함)
    - retrieve: 지출 상세 조회
    - update/partial_update: 지출 수정
    - destroy: 지출 삭제
    """
    queryset = ClosingCashExpense.objects.all()
    serializer_class = ClosingCashExpenseSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        """사용자가 접근 가능한 지출 항목 조회"""
        queryset = super().get_queryset()

        # 특정 클로징에 대한 지출만 조회
        closing_id = self.request.query_params.get('closing_id')
        if closing_id:
            queryset = queryset.filter(daily_closing_id=closing_id)

        # 카테고리별 필터
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        return queryset.select_related('daily_closing', 'created_by')

    def perform_create(self, serializer):
        """created_by를 현재 사용자로 설정"""
        serializer.save(created_by=self.request.user)
