from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Avg, Count
from django.utils import timezone
from datetime import timedelta

from .models import Sales
from .serializers import SalesSerializer
from users.permissions import IsManager
from users.filters import OrganizationFilterBackend


class SalesViewSet(viewsets.ModelViewSet):
    """
    매출 데이터 관리 ViewSet
    - list: 매출 목록 조회
    - create: 매출 기록 생성
    - retrieve: 매출 상세 조회
    - update/partial_update: 매출 수정
    - destroy: 매출 삭제
    - daily_analysis: 일별 매출 분석
    - weekly_analysis: 주별 매출 분석
    - monthly_analysis: 월별 매출 분석
    - summary: 매출 요약 (오늘, 어제, 전체)
    """
    queryset = Sales.objects.all()
    serializer_class = SalesSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        """사용자의 조직에 해당하는 매출만 조회"""
        queryset = super().get_queryset()
        return queryset.select_related('organization', 'created_by__user')

    def perform_create(self, serializer):
        """created_by를 현재 사용자로 설정"""
        try:
            serializer.save(created_by=self.request.user.profile)
        except:
            serializer.save()

    @action(detail=False, methods=['get'])
    def daily_analysis(self, request):
        """
        일별 매출 분석
        Query params:
        - start_date: YYYY-MM-DD (기본: 7일 전)
        - end_date: YYYY-MM-DD (기본: 오늘)
        """
        try:
            # 날짜 범위 설정
            end_date_str = request.query_params.get('end_date')
            start_date_str = request.query_params.get('start_date')

            end_date = timezone.now().date() if not end_date_str else end_date_str
            start_date = (timezone.now().date() - timedelta(days=7)) if not start_date_str else start_date_str

            # 필터링된 데이터 조회
            queryset = self.filter_queryset(self.get_queryset())
            queryset = queryset.filter(date__range=[start_date, end_date])

            # 일별 집계
            daily_data = list(queryset.values('date').annotate(
                total_sales=Sum('amount'),
                transaction_count=Count('id'),
                average_sale=Avg('amount')
            ).order_by('date'))

            total_sales = sum(d['total_sales'] for d in daily_data)

            return Response({
                'start_date': start_date,
                'end_date': end_date,
                'total_period_sales': total_sales,
                'average_daily_sales': total_sales / len(daily_data) if daily_data else 0,
                'daily_breakdown': daily_data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def weekly_analysis(self, request):
        """
        주별 매출 분석
        Query params:
        - weeks: 몇 주 분석할지 (기본: 4주)
        """
        try:
            weeks = int(request.query_params.get('weeks', 4))
            end_date = timezone.now().date()
            start_date = end_date - timedelta(weeks=weeks)

            # 필터링된 데이터 조회
            queryset = self.filter_queryset(self.get_queryset())
            queryset = queryset.filter(date__range=[start_date, end_date])

            # 일별 데이터 먼저 조회
            daily_data = list(queryset.values('date').annotate(
                total_sales=Sum('amount'),
                transaction_count=Count('id')
            ).order_by('date'))

            # 주별로 재구성
            weeks_dict = {}
            for item in daily_data:
                week_start = item['date'] - timedelta(days=item['date'].weekday())
                week_key = str(week_start)
                if week_key not in weeks_dict:
                    weeks_dict[week_key] = {
                        'week_start': week_start,
                        'total_sales': 0,
                        'transaction_count': 0
                    }
                weeks_dict[week_key]['total_sales'] += item['total_sales']
                weeks_dict[week_key]['transaction_count'] += item['transaction_count']

            weekly_breakdown = sorted(weeks_dict.values(), key=lambda x: x['week_start'])
            total_sales = sum(w['total_sales'] for w in weekly_breakdown)

            return Response({
                'start_date': start_date,
                'end_date': end_date,
                'weeks': weeks,
                'total_period_sales': total_sales,
                'average_weekly_sales': total_sales / len(weekly_breakdown) if weekly_breakdown else 0,
                'weekly_breakdown': weekly_breakdown
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def monthly_analysis(self, request):
        """
        월별 매출 분석
        Query params:
        - months: 몇 개월 분석할지 (기본: 12개월)
        """
        try:
            months = int(request.query_params.get('months', 12))
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=30*months)

            # 필터링된 데이터 조회
            queryset = self.filter_queryset(self.get_queryset())
            queryset = queryset.filter(date__range=[start_date, end_date])

            # 일별 데이터 먼저 조회
            daily_data = list(queryset.values('date').annotate(
                total_sales=Sum('amount'),
                transaction_count=Count('id')
            ).order_by('date'))

            # 월별로 재구성
            months_dict = {}
            for item in daily_data:
                month_key = item['date'].strftime('%Y-%m')
                if month_key not in months_dict:
                    months_dict[month_key] = {
                        'month': month_key,
                        'total_sales': 0,
                        'transaction_count': 0
                    }
                months_dict[month_key]['total_sales'] += item['total_sales']
                months_dict[month_key]['transaction_count'] += item['transaction_count']

            monthly_breakdown = sorted(months_dict.values(), key=lambda x: x['month'])
            total_sales = sum(m['total_sales'] for m in monthly_breakdown)

            return Response({
                'start_date': start_date,
                'end_date': end_date,
                'months': months,
                'total_period_sales': total_sales,
                'average_monthly_sales': total_sales / len(monthly_breakdown) if monthly_breakdown else 0,
                'monthly_breakdown': monthly_breakdown
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        매출 요약
        - 오늘 매출
        - 어제 매출
        - 오늘 vs 어제 비교
        - 전체 통계
        """
        try:
            today = timezone.now().date()
            yesterday = today - timedelta(days=1)

            # 필터링된 데이터 조회
            queryset = self.filter_queryset(self.get_queryset())

            # 오늘 데이터
            today_sales = queryset.filter(date=today).aggregate(
                total=Sum('amount'),
                count=Count('id'),
                average=Avg('amount')
            )

            # 어제 데이터
            yesterday_sales = queryset.filter(date=yesterday).aggregate(
                total=Sum('amount'),
                count=Count('id'),
                average=Avg('amount')
            )

            # 전체 데이터
            total_sales = queryset.aggregate(
                total=Sum('amount'),
                count=Count('id'),
                average=Avg('amount')
            )

            return Response({
                'today': {
                    'date': today,
                    'total_sales': float(today_sales['total'] or 0),
                    'transaction_count': today_sales['count'],
                    'average_sale': float(today_sales['average'] or 0)
                },
                'yesterday': {
                    'date': yesterday,
                    'total_sales': float(yesterday_sales['total'] or 0),
                    'transaction_count': yesterday_sales['count'],
                    'average_sale': float(yesterday_sales['average'] or 0)
                },
                'comparison': {
                    'difference': float((today_sales['total'] or 0) - (yesterday_sales['total'] or 0)),
                    'percentage_change': (
                        ((today_sales['total'] or 0) - (yesterday_sales['total'] or 0)) / (yesterday_sales['total'] or 1) * 100
                    ) if yesterday_sales['total'] else 0
                },
                'total': {
                    'total_sales': float(total_sales['total'] or 0),
                    'transaction_count': total_sales['count'],
                    'average_sale': float(total_sales['average'] or 0)
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
