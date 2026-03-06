from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Avg
from django.utils import timezone

from .models import Salary, PayPeriod, PaySlip
from .serializers import SalarySerializer, PayPeriodSerializer, PaySlipDetailSerializer, PaySlipListSerializer
from users.permissions import IsManager
from users.filters import OrganizationFilterBackend


class SalaryViewSet(viewsets.ModelViewSet):
    """
    시급 관리 ViewSet (New Zealand)
    - list: 시급 목록
    - create: 신규 시급 설정
    - retrieve: 시급 상세 조회
    - update/partial_update: 시급 수정
    - destroy: 시급 삭제
    """
    queryset = Salary.objects.all()
    serializer_class = SalarySerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        """사용자의 조직에 해당하는 시급만 조회"""
        queryset = super().get_queryset()
        return queryset.select_related('user__user', 'organization')

    @action(detail=False, methods=['get'])
    def active(self, request):
        """활성 시급만 조회"""
        salaries = self.filter_queryset(self.get_queryset()).filter(is_active=True)
        serializer = self.get_serializer(salaries, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PayPeriodViewSet(viewsets.ModelViewSet):
    """
    급여 지급 기간 관리 ViewSet
    - list: 기간 목록
    - create: 신규 기간 생성
    - retrieve: 기간 상세 조회
    - update/partial_update: 기간 수정
    - finalize: 기간 확정 (급여 계산 완료)
    """
    queryset = PayPeriod.objects.all()
    serializer_class = PayPeriodSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        """사용자의 조직에 해당하는 급여 기간만 조회"""
        queryset = super().get_queryset()
        return queryset.select_related('organization').order_by('-start_date')

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        """급여 기간 확정"""
        pay_period = self.get_object()

        if pay_period.is_finalized:
            return Response(
                {'error': '이미 확정된 기간입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pay_period.is_finalized = True
        pay_period.save()

        return Response(
            {'message': '급여 기간이 확정되었습니다.'},
            status=status.HTTP_200_OK
        )


class PaySlipViewSet(viewsets.ModelViewSet):
    """
    급여명세서 관리 ViewSet (뉴질랜드 법 준수)
    - list: 급여명세서 목록
    - create: 신규 급여명세서 생성
    - retrieve: 급여명세서 상세 조회
    - update/partial_update: 급여명세서 수정 (확정 전)
    - destroy: 급여명세서 삭제 (확정 전)
    - calculate: 급여 자동 계산
    - generate_pdf: PDF 급여명세서 생성
    """
    queryset = PaySlip.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [OrganizationFilterBackend]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return PaySlipDetailSerializer
        return PaySlipListSerializer

    def get_queryset(self):
        """
        Employee: 자신의 급여명세서만
        Manager+: 조직의 모든 급여명세서
        """
        from users.models import UserProfile
        user_profile = self.request.user.profile

        queryset = super().get_queryset().select_related('user__user', 'pay_period')

        if user_profile.role == 'EMPLOYEE':
            queryset = queryset.filter(user=user_profile)

        return queryset.order_by('-pay_period__start_date')

    def perform_create(self, serializer):
        """급여명세서 생성 시 자동 계산"""
        payslip = serializer.save()
        payslip.calculate_salary()
        payslip.save()

    @action(detail=True, methods=['post'])
    def calculate(self, request, pk=None):
        """급여 자동 계산"""
        payslip = self.get_object()

        if payslip.is_locked:
            return Response(
                {'error': '확정된 급여명세서는 수정할 수 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payslip.calculate_salary()
        payslip.save()

        serializer = PaySlipDetailSerializer(payslip)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def calculate_period(self, request):
        """특정 기간의 모든 급여명세서 계산"""
        pay_period_id = request.data.get('pay_period_id')

        if not pay_period_id:
            return Response(
                {'error': '급여 기간 ID가 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            pay_period = PayPeriod.objects.get(id=pay_period_id)
            payslips = self.filter_queryset(self.get_queryset()).filter(pay_period=pay_period)

            count = 0
            for payslip in payslips:
                if not payslip.is_locked:
                    payslip.calculate_salary()
                    payslip.save()
                    count += 1

            return Response({
                'message': f'{count}개의 급여명세서가 계산되었습니다.',
                'count': count
            }, status=status.HTTP_200_OK)

        except PayPeriod.DoesNotExist:
            return Response(
                {'error': '급여 기간을 찾을 수 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def my_payslips(self, request):
        """내 급여명세서 조회 (Employee only)"""
        user_profile = request.user.profile
        payslips = PaySlip.objects.filter(user=user_profile).order_by('-pay_period__start_date')

        serializer = PaySlipListSerializer(payslips, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """급여명세서 요약 정보"""
        payslip = self.get_object()

        summary = {
            'employee': payslip.user.user.get_full_name(),
            'period': f"{payslip.pay_period.start_date} to {payslip.pay_period.end_date}",
            'hours': {
                'regular': float(payslip.regular_hours),
                'overtime': float(payslip.overtime_hours),
                'total': float(payslip.total_hours)
            },
            'earnings': {
                'regular_pay': float(payslip.regular_pay),
                'overtime_pay': float(payslip.overtime_pay),
                'gross_salary': float(payslip.gross_salary)
            },
            'deductions': {
                'paye_tax': float(payslip.paye_tax),
                'kiwisaver': float(payslip.kiwisaver),
                'acc_levy': float(payslip.acc_levy),
                'other': float(payslip.other_deductions),
                'total': float(payslip.total_deductions)
            },
            'net_salary': float(payslip.net_salary),
            'employer_contributions': {
                'kiwisaver': float(payslip.kiwisaver_employer),
                'acc_levy': float(payslip.employer_acc)
            }
        }

        return Response(summary, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def period_summary(self, request):
        """기간별 급여 요약"""
        pay_period_id = request.query_params.get('pay_period_id')

        if not pay_period_id:
            return Response(
                {'error': '급여 기간 ID가 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            pay_period = PayPeriod.objects.get(id=pay_period_id)
            payslips = self.filter_queryset(self.get_queryset()).filter(pay_period=pay_period)

            summary = {
                'period': f"{pay_period.start_date} to {pay_period.end_date}",
                'payment_date': pay_period.payment_date,
                'payslip_count': payslips.count(),
                'totals': {
                    'hours': float(payslips.aggregate(Sum('total_hours'))['total_hours__sum'] or 0),
                    'gross_salary': float(payslips.aggregate(Sum('gross_salary'))['gross_salary__sum'] or 0),
                    'paye_tax': float(payslips.aggregate(Sum('paye_tax'))['paye_tax__sum'] or 0),
                    'kiwisaver': float(payslips.aggregate(Sum('kiwisaver'))['kiwisaver__sum'] or 0),
                    'acc_levy': float(payslips.aggregate(Sum('acc_levy'))['acc_levy__sum'] or 0),
                    'total_deductions': float(payslips.aggregate(Sum('total_deductions'))['total_deductions__sum'] or 0),
                    'net_salary': float(payslips.aggregate(Sum('net_salary'))['net_salary__sum'] or 0)
                }
            }

            return Response(summary, status=status.HTTP_200_OK)

        except PayPeriod.DoesNotExist:
            return Response(
                {'error': '급여 기간을 찾을 수 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
