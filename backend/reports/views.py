from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Avg, Count, F, DecimalField
from django.utils import timezone
from datetime import timedelta

from .models import Report, GeneratedReport
from .serializers import ReportSerializer, GeneratedReportSerializer
from closing.models import DailyClosing
from sales.models import Sales
from users.permissions import IsManager
from users.filters import OrganizationFilterBackend


class ReportViewSet(viewsets.ModelViewSet):
    """
    리포트 관리 ViewSet
    - list: 리포트 목록 조회
    - create: 리포트 생성
    - retrieve: 리포트 상세 조회
    - update/partial_update: 리포트 수정
    - destroy: 리포트 삭제
    - daily_store_report: 일일 매장 리포트
    - store_comparison: 매장 간 비교 리포트
    - sales_performance: 매출 성과 리포트
    """
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        """사용자의 조직에 해당하는 리포트만 조회"""
        queryset = super().get_queryset()
        return queryset.select_related('organization', 'created_by__user')

    @action(detail=False, methods=['get'])
    def daily_store_report(self, request):
        """
        일일 매장 리포트
        - 클로징 현황
        - 매출 현황
        - 차이 분석

        Query params:
        - date: YYYY-MM-DD (기본: 오늘)
        """
        try:
            date_str = request.query_params.get('date')
            target_date = timezone.now().date() if not date_str else date_str

            # 필터링된 조직 데이터 조회
            queryset = self.filter_queryset(self.get_queryset())
            org = queryset.first()

            if not org:
                return Response(
                    {'error': '조직 정보를 찾을 수 없습니다.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 클로징 데이터
            closing = DailyClosing.objects.filter(
                organization=org.organization,
                closing_date=target_date
            ).first()

            # 매출 데이터
            sales = Sales.objects.filter(
                organization=org.organization,
                date=target_date
            ).aggregate(
                total=Sum('amount'),
                count=Count('id'),
                average=Avg('amount')
            )

            return Response({
                'date': target_date,
                'closing': {
                    'id': closing.id if closing else None,
                    'pos_total': float(closing.pos_total) if closing else 0,
                    'actual_total': float(closing.actual_total) if closing else 0,
                    'variance': float(closing.total_variance) if closing else 0,
                    'status': closing.status if closing else 'NOT_STARTED',
                    'hr_cash': float(sum(hc.amount for hc in closing.hr_cash_entries.all())) if closing else 0
                },
                'sales': {
                    'total': float(sales['total'] or 0),
                    'transaction_count': sales['count'],
                    'average_transaction': float(sales['average'] or 0)
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def store_comparison(self, request):
        """
        매장 간 비교 리포트
        - 선택한 날짜의 모든 매장 비교
        - 클로징 현황
        - 매출 현황

        Query params:
        - date: YYYY-MM-DD (기본: 오늘)
        """
        try:
            date_str = request.query_params.get('date')
            target_date = timezone.now().date() if not date_str else date_str

            # 현재 조직 및 하위 조직 찾기
            current_org = self.filter_queryset(self.get_queryset()).first().organization

            # 클로징 데이터
            closings = DailyClosing.objects.filter(
                closing_date=target_date
            ).values('organization__name', 'organization__id').annotate(
                pos_total=Sum('pos_total'),
                actual_total=Sum('actual_total'),
                variance=Sum(F('actual_total') - F('pos_total'), output_field=DecimalField())
            )

            # 매출 데이터
            sales_data = Sales.objects.filter(
                date=target_date
            ).values('organization__name', 'organization__id').annotate(
                total=Sum('amount'),
                count=Count('id'),
                average=Avg('amount')
            )

            # 데이터 결합
            stores = {}
            for closing in closings:
                org_id = closing['organization__id']
                stores[org_id] = {
                    'organization': closing['organization__name'],
                    'closing_pos_total': float(closing['pos_total'] or 0),
                    'closing_actual_total': float(closing['actual_total'] or 0),
                    'closing_variance': float(closing['variance'] or 0),
                    'sales_total': 0,
                    'sales_count': 0,
                    'sales_average': 0
                }

            for sale in sales_data:
                org_id = sale['organization__id']
                if org_id not in stores:
                    stores[org_id] = {
                        'organization': sale['organization__name'],
                        'closing_pos_total': 0,
                        'closing_actual_total': 0,
                        'closing_variance': 0,
                        'sales_total': 0,
                        'sales_count': 0,
                        'sales_average': 0
                    }
                stores[org_id]['sales_total'] = float(sale['total'] or 0)
                stores[org_id]['sales_count'] = sale['count']
                stores[org_id]['sales_average'] = float(sale['average'] or 0)

            return Response({
                'date': target_date,
                'stores': list(stores.values())
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def sales_performance(self, request):
        """
        매출 성과 리포트
        - 일일/주별/월별 성과
        - 목표 대비 달성도
        - 트렌드 분석

        Query params:
        - period: daily, weekly, monthly (기본: daily)
        - days: 분석 기간 (기본: 30)
        """
        try:
            period = request.query_params.get('period', 'daily')
            days = int(request.query_params.get('days', 30))

            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=days)

            # 필터링된 데이터 조회
            queryset = self.filter_queryset(self.get_queryset())
            org = queryset.first()

            if not org:
                return Response(
                    {'error': '조직 정보를 찾을 수 없습니다.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 일별 매출 데이터
            daily_data = Sales.objects.filter(
                organization=org.organization,
                date__range=[start_date, end_date]
            ).values('date').annotate(
                total=Sum('amount'),
                count=Count('id'),
                average=Avg('amount')
            ).order_by('date')

            # 기간별 집계
            if period == 'daily':
                performance_data = list(daily_data)
            elif period == 'weekly':
                weeks_dict = {}
                for item in daily_data:
                    week_start = item['date'] - timedelta(days=item['date'].weekday())
                    week_key = str(week_start)
                    if week_key not in weeks_dict:
                        weeks_dict[week_key] = {
                            'period': week_key,
                            'total': 0,
                            'count': 0,
                            'average': 0,
                            'day_count': 0
                        }
                    weeks_dict[week_key]['total'] += item['total']
                    weeks_dict[week_key]['count'] += item['count']
                    weeks_dict[week_key]['day_count'] += 1

                performance_data = [
                    {
                        'period': w['period'],
                        'total': float(w['total']),
                        'count': w['count'],
                        'average': float(w['total'] / w['day_count']) if w['day_count'] > 0 else 0
                    }
                    for w in sorted(weeks_dict.values(), key=lambda x: x['period'])
                ]
            else:  # monthly
                months_dict = {}
                for item in daily_data:
                    month_key = item['date'].strftime('%Y-%m')
                    if month_key not in months_dict:
                        months_dict[month_key] = {
                            'period': month_key,
                            'total': 0,
                            'count': 0,
                            'average': 0,
                            'day_count': 0
                        }
                    months_dict[month_key]['total'] += item['total']
                    months_dict[month_key]['count'] += item['count']
                    months_dict[month_key]['day_count'] += 1

                performance_data = [
                    {
                        'period': m['period'],
                        'total': float(m['total']),
                        'count': m['count'],
                        'average': float(m['total'] / m['day_count']) if m['day_count'] > 0 else 0
                    }
                    for m in sorted(months_dict.values(), key=lambda x: x['period'])
                ]

            # 통계 계산
            total_sales = sum(p['total'] for p in performance_data)
            avg_sales = total_sales / len(performance_data) if performance_data else 0
            max_sales = max((p['total'] for p in performance_data), default=0)
            min_sales = min((p['total'] for p in performance_data), default=0)

            return Response({
                'period': period,
                'start_date': start_date,
                'end_date': end_date,
                'statistics': {
                    'total': float(total_sales),
                    'average': float(avg_sales),
                    'max': float(max_sales),
                    'min': float(min_sales),
                    'trend': 'up' if len(performance_data) > 1 and performance_data[-1]['total'] > performance_data[0]['total'] else 'down'
                },
                'performance_data': performance_data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class GeneratedReportViewSet(mixins.ListModelMixin,
                             mixins.RetrieveModelMixin,
                             viewsets.GenericViewSet):
    """
    생성된 리포트 조회 ViewSet
    - list: 생성된 리포트 목록
    - retrieve: 리포트 상세 정보
    """
    queryset = GeneratedReport.objects.all()
    serializer_class = GeneratedReportSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        """사용자의 조직에 해당하는 생성된 리포트만 조회"""
        queryset = super().get_queryset()
        return queryset.select_related('report', 'organization', 'generated_by__user')

