from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q, F, Value, DecimalField as DjDecimalField
from django.http import FileResponse

from datetime import date as date_type, datetime, timedelta
import zoneinfo
from decimal import Decimal
from django.db.models import Sum, Count, Avg
from django.db.models.functions import Coalesce

from .models import (
    DailyClosing, ClosingHRCash, ClosingCashExpense, Supplier, SalesCategory,
    ClosingSupplierCost, ClosingOtherSale, SupplierMonthlyStatement, MonthlyClose,
    CQAccountBalance, CQExpense
)
from .serializers import (
    DailyClosingListSerializer, DailyClosingDetailSerializer,
    ClosingHRCashSerializer, ClosingCashExpenseSerializer,
    ClosingSupplierCostSerializer, ClosingOtherSaleSerializer,
    SupplierSerializer, SalesCategorySerializer,
    SupplierMonthlyStatementSerializer, MonthlyCloseSerializer,
    CQAccountBalanceSerializer, CQExpenseSerializer
)
from users.permissions import IsEmployee, IsManager, IsSeniorManager, IsRegionalManager, IsHQ
from users.filters import OrganizationFilterBackend
from utils.pdf_generator import DailyClosingPDFGenerator


class DailyClosingViewSet(viewsets.ModelViewSet):
    """
    데일리 클로징 ViewSet
    - list/create/retrieve: IsEmployee (직원도 접근 가능)
    - update/partial_update/destroy: IsManager (매니저만)
    - approve/reject: IsSeniorManager
    - submit: IsEmployee (직원이 제출)
    """
    queryset = DailyClosing.objects.all()
    permission_classes = [IsAuthenticated, IsEmployee]
    filter_backends = [OrganizationFilterBackend]
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    MANAGER_ROLES = ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']

    def _is_month_closed(self, closing_date, organization):
        """Check if the month containing this closing_date is closed."""
        return MonthlyClose.objects.filter(
            organization=organization,
            year=closing_date.year,
            month=closing_date.month,
            status='CLOSED'
        ).exists()

    def get_permissions(self):
        """액션별 권한 분리"""
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsManager()]
        if self.action in ['approve', 'reject', 'generate_pdf']:
            return [IsAuthenticated(), IsManager()]
        # list, create, retrieve, submit → IsEmployee
        return [IsAuthenticated(), IsEmployee()]

    def get_serializer_class(self):
        """액션에 따라 다른 시리얼라이저 사용"""
        if self.action == 'list':
            return DailyClosingListSerializer
        return DailyClosingDetailSerializer

    def get_queryset(self):
        """직원은 자기 것만, 매니저는 조직 전체. CEO/HQ는 store_id로 전환 가능."""
        queryset = super().get_queryset()
        user = self.request.user

        try:
            profile = user.profile
            org = profile.organization

            # CEO/HQ can switch stores via store_id query param
            if profile.role in ['CEO', 'HQ']:
                store_id = self.request.query_params.get('store_id')
                if store_id:
                    from users.models import Organization
                    try:
                        org = Organization.objects.get(id=store_id)
                    except Organization.DoesNotExist:
                        pass
                if org:
                    queryset = queryset.filter(organization=org)
            elif profile.role in self.MANAGER_ROLES:
                queryset = queryset.filter(organization=org)
            else:
                # 직원은 자기가 만든 것만
                queryset = queryset.filter(organization=org, created_by=profile)
        except Exception:
            queryset = queryset.none()

        # 쿼리 필터
        closing_date = self.request.query_params.get('closing_date')
        if closing_date:
            queryset = queryset.filter(closing_date=closing_date)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.select_related('organization', 'created_by', 'approved_by')

    def create(self, request, *args, **kwargs):
        """신규 클로징 생성 (DRAFT 상태)"""
        profile = request.user.profile
        org = profile.organization
        is_manager = profile.role in self.MANAGER_ROLES

        # 직원 권한 체크 (매니저는 항상 가능)
        if not is_manager and not profile.can_daily_close:
            return Response(
                {'detail': 'Daily Close 권한이 없습니다. 매니저에게 문의하세요.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 클로징 시간 제한 체크 (매니저는 제한 없음)
        if not is_manager and org.closing_time:
            nz_tz = zoneinfo.ZoneInfo('Pacific/Auckland')
            now_nz = datetime.now(nz_tz).time()
            closing_dt = datetime.combine(date_type.today(), org.closing_time)
            earliest_dt = closing_dt - timedelta(minutes=30)
            earliest_time = earliest_dt.time()
            if now_nz < earliest_time:
                return Response(
                    {'detail': f'Daily Close는 마감 30분 전부터 가능합니다 ({earliest_time.strftime("%H:%M")} 이후)'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        closing_date_str = request.data.get('closing_date')
        if closing_date_str:
            try:
                cd = date_type.fromisoformat(closing_date_str)
                if self._is_month_closed(cd, org):
                    return Response(
                        {'detail': f'Cannot create closing: {cd.strftime("%B %Y")} is closed.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, AttributeError):
                pass
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        """created_by를 현재 사용자로 설정"""
        serializer.save(created_by=self.request.user.profile, status='DRAFT')

    def update(self, request, *args, **kwargs):
        """클로징 수정 (매니저는 모든 상태 수정 가능, 직원은 DRAFT만)"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        if self._is_month_closed(instance.closing_date, instance.organization):
            return Response(
                {'detail': f'Cannot edit closing: {instance.closing_date.strftime("%B %Y")} is closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile = request.user.profile
        is_manager = profile.role in self.MANAGER_ROLES
        if not is_manager and instance.status != 'DRAFT':
            return Response(
                {'detail': f'DRAFT 상태인 클로징만 수정할 수 있습니다. 현재 상태: {instance.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """클로징 삭제 (매니저는 모든 상태 삭제 가능, 직원은 DRAFT만)"""
        instance = self.get_object()

        if self._is_month_closed(instance.closing_date, instance.organization):
            return Response(
                {'detail': f'Cannot delete closing: {instance.closing_date.strftime("%B %Y")} is closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile = request.user.profile
        is_manager = profile.role in self.MANAGER_ROLES
        if not is_manager and instance.status != 'DRAFT':
            return Response(
                {'detail': f'DRAFT 상태인 클로징만 삭제할 수 있습니다. 현재 상태: {instance.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsManager])
    def approve(self, request, pk=None):
        """클로징 승인 (Manager 이상 가능)"""
        closing = self.get_object()

        if self._is_month_closed(closing.closing_date, closing.organization):
            return Response(
                {'detail': f'Cannot approve: {closing.closing_date.strftime("%B %Y")} is closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if closing.status not in ('DRAFT', 'SUBMITTED'):
            return Response(
                {'detail': f'DRAFT 또는 SUBMITTED 상태인 클로징만 승인할 수 있습니다. 현재 상태: {closing.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        closing.status = 'APPROVED'
        closing.approved_by = request.user.profile
        closing.approved_at = timezone.now()
        closing.save()

        serializer = self.get_serializer(closing)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsSeniorManager])
    def reject(self, request, pk=None):
        """클로징 거부 (Senior Manager 이상만 가능)"""
        closing = self.get_object()

        if self._is_month_closed(closing.closing_date, closing.organization):
            return Response(
                {'detail': f'Cannot reject: {closing.closing_date.strftime("%B %Y")} is closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if closing.status not in ('DRAFT', 'SUBMITTED'):
            return Response(
                {'detail': f'DRAFT 또는 SUBMITTED 상태인 클로징만 거부할 수 있습니다. 현재 상태: {closing.status}'},
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

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsEmployee])
    def submit(self, request, pk=None):
        """클로징 제출 (DRAFT → SUBMITTED)"""
        closing = self.get_object()

        if self._is_month_closed(closing.closing_date, closing.organization):
            return Response(
                {'detail': f'Cannot submit: {closing.closing_date.strftime("%B %Y")} is closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if closing.status != 'DRAFT':
            return Response(
                {'detail': f'DRAFT 상태인 클로징만 제출할 수 있습니다. 현재 상태: {closing.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        closing.status = 'SUBMITTED'
        closing.save()

        serializer = self.get_serializer(closing)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated, IsManager])
    def generate_pdf(self, request, pk=None):
        """클로징 PDF 보고서 생성"""
        closing = self.get_object()

        try:
            # Prepare closing data
            closing_data = {
                'date': closing.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'pos_card': float(closing.pos_card or 0),
                'pos_cash': float(closing.pos_cash or 0),
                'actual_card': float(closing.actual_card or 0),
                'actual_cash': float(closing.actual_cash or 0),
                'status': closing.status,
                'variance': float(closing.variance or 0),
            }

            # Add HR cash if available
            hr_cash = closing.closinghrcash.first()
            if hr_cash:
                closing_data['hr_cash'] = float(hr_cash.amount)

            # Add expenses
            expenses = closing.closingcashexpense_set.all()
            closing_data['expenses'] = [
                {
                    'category': exp.get_category_display(),
                    'reason': exp.reason,
                    'amount': float(exp.amount),
                }
                for exp in expenses
            ]

            # Generate PDF
            pdf_generator = DailyClosingPDFGenerator()
            company_name = closing.organization.name
            pdf_buffer = pdf_generator.generate(closing_data, company_name)

            # Return PDF file
            filename = f"closing_{closing.id}_{closing.created_at.strftime('%Y%m%d')}.pdf"
            return FileResponse(
                pdf_buffer,
                as_attachment=True,
                filename=filename,
                content_type='application/pdf'
            )
        except Exception as e:
            return Response(
                {'error': f'PDF 생성 실패: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
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
    parser_classes = (MultiPartParser, FormParser, JSONParser)
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


class SupplierViewSet(viewsets.ModelViewSet):
    """공급사 관리 ViewSet (Store Settings에서 사용)"""
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def _get_target_org(self):
        """CEO/HQ가 store_id로 특정 매장 선택 시 해당 매장 반환"""
        from users.models import Organization
        store_id = self.request.query_params.get('store_id')
        if store_id and self.request.user.profile.role in ['CEO', 'HQ', 'REGIONAL_MANAGER', 'SENIOR_MANAGER']:
            try:
                return Organization.objects.get(id=store_id)
            except Organization.DoesNotExist:
                pass
        return self.request.user.profile.organization

    def perform_create(self, serializer):
        serializer.save(organization=self._get_target_org())

    def perform_update(self, serializer):
        serializer.save()


class SalesCategoryViewSet(viewsets.ModelViewSet):
    """매출 카테고리 관리 ViewSet (Store Settings에서 사용)"""
    queryset = SalesCategory.objects.all()
    serializer_class = SalesCategorySerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def _get_target_org(self):
        """CEO/HQ가 store_id로 특정 매장 선택 시 해당 매장 반환"""
        from users.models import Organization
        store_id = self.request.query_params.get('store_id')
        if store_id and self.request.user.profile.role in ['CEO', 'HQ', 'REGIONAL_MANAGER', 'SENIOR_MANAGER']:
            try:
                return Organization.objects.get(id=store_id)
            except Organization.DoesNotExist:
                pass
        return self.request.user.profile.organization

    def perform_create(self, serializer):
        serializer.save(organization=self._get_target_org())


class ClosingSupplierCostViewSet(mixins.CreateModelMixin,
                                  mixins.ListModelMixin,
                                  mixins.RetrieveModelMixin,
                                  mixins.UpdateModelMixin,
                                  mixins.DestroyModelMixin,
                                  viewsets.GenericViewSet):
    """
    공급사 비용 ViewSet (DailyClosing 하위)
    - list: 공급사 비용 목록 (?closing_id= 필터)
    - create: 공급사 비용 추가 (같은 업체 다건 가능)
    - update/destroy: 수정/삭제
    """
    queryset = ClosingSupplierCost.objects.all()
    serializer_class = ClosingSupplierCostSerializer
    permission_classes = [IsAuthenticated, IsManager]
    parser_classes = (JSONParser,)
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        try:
            org = self.request.user.profile.organization
            queryset = queryset.filter(closing__organization=org)
        except Exception:
            queryset = queryset.none()

        closing_id = self.request.query_params.get('closing_id')
        if closing_id:
            queryset = queryset.filter(closing_id=closing_id)

        return queryset.select_related('closing', 'supplier')


class ClosingOtherSaleViewSet(mixins.CreateModelMixin,
                               mixins.ListModelMixin,
                               mixins.DestroyModelMixin,
                               viewsets.GenericViewSet):
    """
    기타 매출 ViewSet (DailyClosing 하위)
    - list: 기타 매출 목록 (?closing_id= 필터)
    - create: 기타 매출 추가
    - destroy: 기타 매출 삭제
    """
    queryset = ClosingOtherSale.objects.all()
    serializer_class = ClosingOtherSaleSerializer
    permission_classes = [IsAuthenticated, IsEmployee]
    parser_classes = (JSONParser,)
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        try:
            org = self.request.user.profile.organization
            queryset = queryset.filter(closing__organization=org)
        except Exception:
            queryset = queryset.none()

        closing_id = self.request.query_params.get('closing_id')
        if closing_id:
            queryset = queryset.filter(closing_id=closing_id)

        return queryset.select_related('closing')


class SupplierMonthlyStatementViewSet(mixins.CreateModelMixin,
                                       mixins.ListModelMixin,
                                       mixins.RetrieveModelMixin,
                                       mixins.UpdateModelMixin,
                                       viewsets.GenericViewSet):
    """
    공급사 월별 명세서 ViewSet
    - list: 명세서 목록 (?year=&month=&supplier= 필터)
    - create: 명세서 업로드 + 자동 대사
    - reconcile: 재대사 실행
    """
    queryset = SupplierMonthlyStatement.objects.all()
    serializer_class = SupplierMonthlyStatementSerializer
    permission_classes = [IsAuthenticated, IsManager]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        try:
            org = self.request.user.profile.organization
            queryset = queryset.filter(organization=org)
        except Exception:
            queryset = queryset.none()

        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        supplier = self.request.query_params.get('supplier')
        if year:
            queryset = queryset.filter(year=year)
        if month:
            queryset = queryset.filter(month=month)
        if supplier:
            queryset = queryset.filter(supplier_id=supplier)

        return queryset.select_related('supplier', 'uploaded_by__user')

    def perform_create(self, serializer):
        org = self.request.user.profile.organization
        instance = serializer.save(
            organization=org,
            uploaded_by=self.request.user.profile
        )
        instance.reconcile()

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        """재대사 실행"""
        statement = self.get_object()
        statement.reconcile()
        serializer = self.get_serializer(statement)
        return Response(serializer.data)


class MonthlyCloseViewSet(mixins.ListModelMixin,
                           mixins.RetrieveModelMixin,
                           viewsets.GenericViewSet):
    """
    Monthly Close ViewSet
    - list: Monthly close records (?year=&month= filters)
    - summary: GET - returns checklist status for a month
    - close_month: POST - closes the month (IsSeniorManager)
    - reopen: POST - reopens a closed month (IsSeniorManager)
    """
    queryset = MonthlyClose.objects.all()
    serializer_class = MonthlyCloseSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        try:
            org = self.request.user.profile.organization
            queryset = queryset.filter(organization=org)
        except Exception:
            queryset = queryset.none()

        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year:
            queryset = queryset.filter(year=year)
        if month:
            queryset = queryset.filter(month=month)

        return queryset.select_related('organization', 'closed_by__user')

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        GET /api/closing/monthly-close/summary/?year=2026&month=3
        Returns checklist of readiness for closing the month.
        """
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        if not year or not month:
            return Response(
                {'detail': 'year and month query params are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        year = int(year)
        month = int(month)
        org = request.user.profile.organization

        # Date range for the month
        start_date = date_type(year, month, 1)
        if month == 12:
            end_date = date_type(year + 1, 1, 1)
        else:
            end_date = date_type(year, month + 1, 1)

        # --- Daily Closings ---
        closings = DailyClosing.objects.filter(
            organization=org,
            closing_date__gte=start_date,
            closing_date__lt=end_date,
        )
        total_closings = closings.count()
        approved_closings = closings.filter(status='APPROVED').count()
        submitted_closings = closings.filter(status='SUBMITTED').count()
        draft_closings = closings.filter(status='DRAFT').count()
        rejected_closings = closings.filter(status='REJECTED').count()

        # Outstanding (not approved) closings
        outstanding_closings = list(closings.exclude(status='APPROVED').values(
            'id', 'closing_date', 'status'
        ))

        # --- Supplier Statements ---
        # Count distinct suppliers with costs this month
        suppliers_with_costs = ClosingSupplierCost.objects.filter(
            closing__organization=org,
            closing__closing_date__gte=start_date,
            closing__closing_date__lt=end_date,
        ).values('supplier_id').distinct().count()

        statements = SupplierMonthlyStatement.objects.filter(
            organization=org,
            year=year,
            month=month,
        )
        total_statements = statements.count()
        matched_statements = statements.filter(status='MATCHED').count()
        mismatched_statements = statements.filter(status='MISMATCHED').count()
        pending_statements = statements.filter(status='PENDING').count()

        outstanding_statements = list(statements.exclude(status='MATCHED').values(
            'id', 'supplier__name', 'statement_total', 'our_total',
            'variance', 'status'
        ))

        # Suppliers without statements
        suppliers_without_stmt = suppliers_with_costs - total_statements

        # --- Monthly Close record ---
        monthly_close = MonthlyClose.objects.filter(
            organization=org, year=year, month=month
        ).first()

        monthly_close_data = None
        if monthly_close:
            monthly_close_data = MonthlyCloseSerializer(monthly_close).data

        # --- Aggregated financials (from approved closings) ---
        totals = closings.filter(status='APPROVED').aggregate(
            total_pos_card=Sum('pos_card'),
            total_pos_cash=Sum('pos_cash'),
            total_actual_card=Sum('actual_card'),
            total_actual_cash=Sum('actual_cash'),
            total_bank_deposit=Sum('bank_deposit'),
        )

        all_ready = (
            total_closings > 0
            and approved_closings == total_closings
            and (total_statements == 0 or matched_statements == total_statements)
        )

        return Response({
            'year': year,
            'month': month,
            'monthly_close': monthly_close_data,
            'all_ready': all_ready,
            'daily_closings': {
                'total': total_closings,
                'approved': approved_closings,
                'submitted': submitted_closings,
                'draft': draft_closings,
                'rejected': rejected_closings,
                'outstanding': outstanding_closings,
            },
            'supplier_statements': {
                'total': total_statements,
                'matched': matched_statements,
                'mismatched': mismatched_statements,
                'pending': pending_statements,
                'suppliers_with_costs': suppliers_with_costs,
                'suppliers_without_statement': suppliers_without_stmt,
                'outstanding': outstanding_statements,
            },
            'totals': {k: float(v or 0) for k, v in totals.items()},
        })

    @action(detail=False, methods=['post'], url_path='close-month',
            permission_classes=[IsAuthenticated, IsSeniorManager])
    def close_month(self, request):
        """
        POST /api/closing/monthly-close/close-month/
        Body: { year, month, notes? }
        """
        year = request.data.get('year')
        month = request.data.get('month')
        notes = request.data.get('notes', '')

        if not year or not month:
            return Response(
                {'detail': 'year and month are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        org = request.user.profile.organization

        monthly_close, created = MonthlyClose.objects.get_or_create(
            organization=org,
            year=int(year),
            month=int(month),
            defaults={
                'status': 'CLOSED',
                'closed_by': request.user.profile,
                'closed_at': timezone.now(),
                'notes': notes,
            }
        )

        if not created:
            if monthly_close.status == 'CLOSED':
                return Response(
                    {'detail': 'This month is already closed.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            monthly_close.status = 'CLOSED'
            monthly_close.closed_by = request.user.profile
            monthly_close.closed_at = timezone.now()
            monthly_close.notes = notes
            monthly_close.save()

        serializer = MonthlyCloseSerializer(monthly_close)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='reopen',
            permission_classes=[IsAuthenticated, IsSeniorManager])
    def reopen(self, request):
        """
        POST /api/closing/monthly-close/reopen/
        Body: { year, month, notes? }
        """
        year = request.data.get('year')
        month = request.data.get('month')
        notes = request.data.get('notes', '')

        if not year or not month:
            return Response(
                {'detail': 'year and month are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        org = request.user.profile.organization

        try:
            monthly_close = MonthlyClose.objects.get(
                organization=org, year=int(year), month=int(month)
            )
        except MonthlyClose.DoesNotExist:
            return Response(
                {'detail': 'No monthly close record found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if monthly_close.status != 'CLOSED':
            return Response(
                {'detail': 'This month is not closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        monthly_close.status = 'OPEN'
        monthly_close.notes = notes
        monthly_close.save()

        serializer = MonthlyCloseSerializer(monthly_close)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CQAccountBalanceViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    """CQ 계정 발란스 ViewSet"""
    queryset = CQAccountBalance.objects.all()
    serializer_class = CQAccountBalanceSerializer
    permission_classes = [IsAuthenticated, IsSeniorManager]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    @action(detail=False, methods=['post'], url_path='update-balance')
    def update_balance(self, request):
        """POST /closing/cq-balance/update-balance/
        Body: { account: 'CHCH'|'QT', balance: 150000 }
        """
        account = request.data.get('account')
        balance = request.data.get('balance')

        if not account or balance is None:
            return Response(
                {'detail': 'account and balance are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        org = request.user.profile.organization
        obj, created = CQAccountBalance.objects.update_or_create(
            organization=org,
            account=account,
            defaults={
                'balance': balance,
                'updated_by': request.user.profile,
            }
        )
        serializer = CQAccountBalanceSerializer(obj)
        return Response(serializer.data)


class CQExpenseViewSet(viewsets.ModelViewSet):
    """CQ Expense ViewSet (건별 승인)"""
    queryset = CQExpense.objects.all()
    serializer_class = CQExpenseSerializer
    permission_classes = [IsAuthenticated, IsSeniorManager]
    filter_backends = [OrganizationFilterBackend]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        account = self.request.query_params.get('account')
        expense_status = self.request.query_params.get('status')
        date_start = self.request.query_params.get('date_start')
        date_end = self.request.query_params.get('date_end')
        if account:
            qs = qs.filter(account=account)
        if expense_status:
            qs = qs.filter(status=expense_status)
        if date_start:
            qs = qs.filter(date__gte=date_start)
        if date_end:
            qs = qs.filter(date__lte=date_end)
        return qs.select_related('created_by__user', 'approved_by__user')

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.profile.organization,
            created_by=self.request.user.profile,
            status='PENDING',
        )

    def perform_destroy(self, instance):
        if instance.status == 'APPROVED':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Cannot delete an approved expense.')
        instance.delete()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """POST /closing/cq-expenses/{id}/approve/
        상대방 것만 Approve 가능
        """
        expense = self.get_object()

        if expense.status == 'APPROVED':
            return Response(
                {'detail': 'Already approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if expense.created_by == request.user.profile:
            return Response(
                {'detail': 'You cannot approve your own expense.'},
                status=status.HTTP_403_FORBIDDEN
            )

        expense.status = 'APPROVED'
        expense.approved_by = request.user.profile
        expense.approved_at = timezone.now()
        expense.save()

        serializer = self.get_serializer(expense)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='combined-ledger')
    def combined_ledger(self, request):
        """GET /closing/cq-expenses/combined-ledger/?date_start=&date_end=
        HR Cash expenses (매니저) + CQ expenses (어드민) 통합 내역
        """
        date_start = request.query_params.get('date_start')
        date_end = request.query_params.get('date_end')
        org = request.user.profile.organization

        results = []

        # HR Cash expenses (managers wrote during daily closing, reason=ChCh or QT)
        hr_qs = ClosingCashExpense.objects.filter(
            daily_closing__organization=org,
            reason__in=['ChCh', 'QT'],
        ).select_related('daily_closing', 'created_by')
        if date_start:
            hr_qs = hr_qs.filter(daily_closing__closing_date__gte=date_start)
        if date_end:
            hr_qs = hr_qs.filter(daily_closing__closing_date__lte=date_end)

        for e in hr_qs:
            results.append({
                'id': f'hr-{e.id}',
                'source': 'hr_cash',
                'account': e.reason,
                'description': e.get_category_display(),
                'amount': str(e.amount),
                'date': str(e.daily_closing.closing_date),
                'created_by_name': e.created_by.get_full_name() or e.created_by.username,
                'attachment': e.attachment.url if e.attachment else None,
                'status': 'APPROVED',
            })

        # CQ expenses (admins)
        cq_qs = CQExpense.objects.filter(
            organization=org,
        ).select_related('created_by__user', 'approved_by__user')
        if date_start:
            cq_qs = cq_qs.filter(date__gte=date_start)
        if date_end:
            cq_qs = cq_qs.filter(date__lte=date_end)

        for e in cq_qs:
            created_name = ''
            if e.created_by:
                created_name = e.created_by.user.get_full_name() or e.created_by.user.username
            approved_name = None
            if e.approved_by:
                approved_name = e.approved_by.user.get_full_name() or e.approved_by.user.username

            category = getattr(e, 'category', 'EXPENSE') or 'EXPENSE'

            # Original entry (out from this account)
            entry = {
                'id': f'cq-{e.id}',
                'source': 'cq',
                'account': e.get_account_display(),
                'category': category,
                'description': e.description,
                'amount': str(e.amount),
                'exchange_rate': str(e.exchange_rate) if e.exchange_rate else None,
                'krw_amount': str(e.krw_amount) if e.krw_amount else None,
                'date': str(e.date),
                'created_by_name': created_name,
                'attachment': e.attachment.url if e.attachment else None,
                'status': e.status,
                'approved_by_name': approved_name,
            }
            # KRW account expenses: amount is in KRW (no dollar)
            if e.account == 'KRW':
                entry['currency'] = 'KRW'
            results.append(entry)

            # For transfers, add mirror entry (in to the other account)
            if category == 'TRANSFER':
                other_account = 'QT' if e.account == 'CHCH' else 'ChCh'
                results.append({
                    'id': f'tf-{e.id}',
                    'source': 'transfer_in',
                    'account': other_account,
                    'category': 'TRANSFER',
                    'description': f'Transfer from {e.get_account_display()}',
                    'amount': str(e.amount),
                    'date': str(e.date),
                    'created_by_name': created_name,
                    'attachment': None,
                    'status': e.status,
                    'approved_by_name': approved_name,
                })

            # For exchanges, add mirror entry (in to KRW account)
            if category == 'EXCHANGE' and e.account != 'KRW' and e.krw_amount:
                results.append({
                    'id': f'ex-{e.id}',
                    'source': 'exchange_in',
                    'account': 'KRW',
                    'category': 'EXCHANGE',
                    'description': f'Exchange from {e.get_account_display()} (@{e.exchange_rate})',
                    'amount': str(e.krw_amount),
                    'exchange_rate': str(e.exchange_rate) if e.exchange_rate else None,
                    'krw_amount': str(e.krw_amount),
                    'currency': 'KRW',
                    'date': str(e.date),
                    'created_by_name': created_name,
                    'attachment': None,
                    'status': e.status,
                    'approved_by_name': approved_name,
                })

        # Sort by date desc
        results.sort(key=lambda x: x['date'], reverse=True)
        return Response(results)


class SalesAnalysisViewSet(viewsets.GenericViewSet):
    """
    Sales Analysis API — 역할별 매출 분석

    - GET /store/    — 지점 매출 분석 (MANAGER+)
    - GET /regional/ — 지역 매출 분석 (REGIONAL_MANAGER+)
    - GET /enterprise/ — 엔터프라이즈 매출 분석 (HQ+)
    """
    permission_classes = [IsAuthenticated, IsManager]

    # ── helpers ───────────────────────────────────────────────

    def _parse_dates(self, request):
        """Parse start_date / end_date from query params, default to current month."""
        start = request.query_params.get('start_date')
        end = request.query_params.get('end_date')
        today = date_type.today()
        if start:
            try:
                start = date_type.fromisoformat(start)
            except ValueError:
                start = today.replace(day=1)
        else:
            start = today.replace(day=1)
        if end:
            try:
                end = date_type.fromisoformat(end)
            except ValueError:
                end = today
        else:
            end = today
        return start, end

    def _prev_period(self, start, end):
        """같은 길이의 직전 기간"""
        delta = (end - start).days + 1
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=delta - 1)
        return prev_start, prev_end

    def _aggregate_for_orgs(self, org_ids, start, end):
        """
        여러 org의 DailyClosing을 일자별로 집계.
        Returns (daily_rows list, totals dict)
        """
        qs = DailyClosing.objects.filter(
            organization_id__in=org_ids,
            closing_date__range=[start, end],
        )

        # Daily aggregation
        daily = (
            qs.values('closing_date')
            .annotate(
                card=Coalesce(Sum('actual_card'), Decimal('0')),
                cash=Coalesce(Sum('actual_cash'), Decimal('0')),
                transactions=Coalesce(Sum('tab_count'), 0),
            )
            .order_by('closing_date')
        )

        # Other sales per day
        other_qs = ClosingOtherSale.objects.filter(
            closing__organization_id__in=org_ids,
            closing__closing_date__range=[start, end],
        )
        other_by_date = {}
        for row in other_qs.values('closing__closing_date').annotate(total=Sum('amount')):
            other_by_date[row['closing__closing_date']] = float(row['total'] or 0)

        # Other sales by name
        other_by_name = list(
            other_qs.values('name')
            .annotate(total=Sum('amount'))
            .order_by('-total')
        )

        daily_rows = []
        total_card = Decimal('0')
        total_cash = Decimal('0')
        total_other = Decimal('0')
        total_tx = 0
        days_count = 0

        for row in daily:
            d = row['closing_date']
            card = row['card']
            cash = row['cash']
            other = Decimal(str(other_by_date.get(d, 0)))
            total = card + cash + other
            tx = row['transactions']

            daily_rows.append({
                'date': str(d),
                'card': float(card),
                'cash': float(cash),
                'other': float(other),
                'total': float(total),
                'tab_count': tx,
            })
            total_card += card
            total_cash += cash
            total_other += other
            total_tx += tx
            days_count += 1

        total_sales = total_card + total_cash + total_other
        totals = {
            'total_sales': float(total_sales),
            'total_card': float(total_card),
            'total_cash': float(total_cash),
            'total_other': float(total_other),
            'total_transactions': total_tx,
            'days_with_data': days_count,
            'avg_daily': float(total_sales / days_count) if days_count else 0,
            'avg_ticket': float(total_sales / total_tx) if total_tx else 0,
        }

        breakdown = []
        for item in other_by_name:
            breakdown.append({
                'name': item['name'],
                'total': float(item['total'] or 0),
            })

        return daily_rows, totals, breakdown

    def _period_total(self, org_ids, start, end):
        """기간 내 total actual sales"""
        agg = DailyClosing.objects.filter(
            organization_id__in=org_ids,
            closing_date__range=[start, end],
        ).aggregate(
            card=Coalesce(Sum('actual_card'), Decimal('0')),
            cash=Coalesce(Sum('actual_cash'), Decimal('0')),
        )
        other_agg = ClosingOtherSale.objects.filter(
            closing__organization_id__in=org_ids,
            closing__closing_date__range=[start, end],
        ).aggregate(total=Coalesce(Sum('amount'), Decimal('0')))
        return float(agg['card'] + agg['cash'] + (other_agg['total'] or 0))

    def _per_org_totals(self, org_ids, start, end, labor_data=None, op_hours_data=None):
        """조직별 총매출 + 노동 메트릭 집계"""
        from users.models import Organization
        qs = DailyClosing.objects.filter(
            organization_id__in=org_ids,
            closing_date__range=[start, end],
        )
        per_org = (
            qs.values('organization_id', 'organization__name')
            .annotate(
                card=Coalesce(Sum('actual_card'), Decimal('0')),
                cash=Coalesce(Sum('actual_cash'), Decimal('0')),
                transactions=Coalesce(Sum('tab_count'), 0),
                days_count=Count('id'),
            )
        )

        # Other sales per org
        other_per_org = {}
        for row in ClosingOtherSale.objects.filter(
            closing__organization_id__in=org_ids,
            closing__closing_date__range=[start, end],
        ).values('closing__organization_id').annotate(total=Sum('amount')):
            other_per_org[row['closing__organization_id']] = float(row['total'] or 0)

        results = []
        for row in per_org:
            oid = row['organization_id']
            other = Decimal(str(other_per_org.get(oid, 0)))
            total = row['card'] + row['cash'] + other
            days = row['days_count']
            ts = float(total)

            entry = {
                'organization': {'id': oid, 'name': row['organization__name']},
                'total_sales': ts,
                'total_card': float(row['card']),
                'total_cash': float(row['cash']),
                'total_other': float(other),
                'total_transactions': row['transactions'],
                'days_with_data': days,
                'avg_daily': float(total / days) if days else 0,
                'avg_ticket': round(ts / row['transactions'], 2) if row['transactions'] else 0,
            }

            # Merge labor data
            if labor_data and oid in labor_data.get('per_org', {}):
                org_labor = labor_data['per_org'][oid]
                lh = org_labor['hours']
                lc = org_labor['cost']
                entry['labor_hours'] = lh
                entry['labor_cost'] = lc
                entry['headcount'] = org_labor['headcount']
                entry['splh'] = round(ts / lh, 2) if lh else 0
                entry['labor_pct'] = round((lc / ts) * 100, 1) if ts else 0
            else:
                entry['labor_hours'] = 0
                entry['labor_cost'] = 0
                entry['headcount'] = 0
                entry['splh'] = 0
                entry['labor_pct'] = 0

            # Operating hours
            if op_hours_data and oid in op_hours_data:
                daily_op = op_hours_data[oid]
                total_op = daily_op * days
                entry['daily_op_hours'] = daily_op
                entry['sales_per_op_hour'] = round(ts / total_op, 2) if total_op else 0
            else:
                entry['daily_op_hours'] = 0
                entry['sales_per_op_hour'] = 0

            results.append(entry)
        results.sort(key=lambda x: x['total_sales'], reverse=True)
        for i, r in enumerate(results):
            r['rank'] = i + 1
        return results

    def _labor_metrics(self, org_ids, start, end):
        """
        Timesheet + Salary 기반 노동 메트릭 집계.
        Returns dict: {
            total_labor_hours, total_labor_cost, headcount,
            labor_hours_per_org: {org_id: {hours, cost, headcount}},
            labor_hours_per_date: {date: hours},
        }
        """
        from hr.models import Timesheet
        from payroll.models import Salary
        from django.db.models import FloatField
        from django.db.models.expressions import RawSQL

        # ── Timesheet aggregation ──
        # MySQL doesn't support Extract('epoch') on DurationField.
        # Use TIMESTAMPDIFF(SECOND, check_in, check_out) instead.
        ts_qs = Timesheet.objects.filter(
            organization_id__in=org_ids,
            date__range=[start, end],
            check_in__isnull=False,
            check_out__isnull=False,
        ).annotate(
            duration_secs=RawSQL(
                "TIMESTAMPDIFF(SECOND, check_in, check_out)",
                [],
                output_field=FloatField()
            ),
        )

        # Per-org totals
        per_org_labor = {}
        for row in ts_qs.values('organization_id').annotate(
            total_secs=Sum('duration_secs'),
            total_break_mins=Sum('total_break_minutes'),
            hcount=Count('user_id', distinct=True),
        ):
            oid = row['organization_id']
            total_hours = (row['total_secs'] or 0) / 3600 - (row['total_break_mins'] or 0) / 60
            per_org_labor[oid] = {
                'hours': round(max(total_hours, 0), 1),
                'headcount': row['hcount'],
                'cost': 0,  # filled below
            }

        # Per-date labor hours (for daily SPLH)
        per_date_labor = {}
        for row in ts_qs.values('date').annotate(
            total_secs=Sum('duration_secs'),
            total_break_mins=Sum('total_break_minutes'),
        ):
            d = row['date']
            total_hours = (row['total_secs'] or 0) / 3600 - (row['total_break_mins'] or 0) / 60
            per_date_labor[d] = round(max(total_hours, 0), 1)

        total_labor_hours = sum(v['hours'] for v in per_org_labor.values())
        total_headcount = len(set(
            ts_qs.values_list('user_id', flat=True)
        ))

        # ── Labor cost from Salary ──
        # Get active salaries for users who worked
        user_ids_by_org = {}
        for row in ts_qs.values('organization_id', 'user_id').distinct():
            user_ids_by_org.setdefault(row['organization_id'], set()).add(row['user_id'])

        all_user_ids = set()
        for uids in user_ids_by_org.values():
            all_user_ids.update(uids)

        # Fetch hourly rates — prefer active salary effective within the date range
        salary_map = {}  # user_id -> hourly_rate
        if all_user_ids:
            salaries = Salary.objects.filter(
                user_id__in=all_user_ids,
                is_active=True,
            ).order_by('user_id', '-effective_from')
            for sal in salaries:
                if sal.user_id not in salary_map:
                    salary_map[sal.user_id] = float(sal.hourly_rate)

        total_labor_cost = 0
        for oid, data in per_org_labor.items():
            org_user_ids = user_ids_by_org.get(oid, set())
            # Simple estimate: hours * avg hourly rate for those users
            org_rates = [salary_map.get(uid, 0) for uid in org_user_ids]
            avg_rate = sum(org_rates) / len(org_rates) if org_rates else 0
            cost = data['hours'] * avg_rate
            data['cost'] = round(cost, 2)
            data['avg_hourly_rate'] = round(avg_rate, 2)
            total_labor_cost += cost

        return {
            'total_labor_hours': round(total_labor_hours, 1),
            'total_labor_cost': round(total_labor_cost, 2),
            'headcount': total_headcount,
            'per_org': per_org_labor,
            'per_date': {str(k): v for k, v in per_date_labor.items()},
        }

    def _operating_hours(self, org_ids, days_count):
        """
        Organization opening/closing time 기반 운영 시간 집계.
        Returns: total_operating_hours, per_org: {org_id: daily_hours}
        """
        from users.models import Organization
        from datetime import datetime, time as time_type

        orgs = Organization.objects.filter(id__in=org_ids, opening_time__isnull=False, closing_time__isnull=False)
        per_org = {}
        for org in orgs:
            if org.opening_time and org.closing_time:
                open_dt = datetime.combine(datetime.today(), org.opening_time)
                close_dt = datetime.combine(datetime.today(), org.closing_time)
                daily_hours = (close_dt - open_dt).total_seconds() / 3600
                if daily_hours <= 0:
                    daily_hours += 24  # crosses midnight
                per_org[org.id] = round(daily_hours, 1)
            else:
                per_org[org.id] = 0

        total = sum(h * days_count for h in per_org.values() if h > 0)
        return round(total, 1), per_org

    # ── endpoints ─────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='store',
            permission_classes=[IsAuthenticated, IsManager])
    def store(self, request):
        """지점(Store) 매출 분석"""
        profile = request.user.profile
        start, end = self._parse_dates(request)

        # Drill-down: 상위 역할이 특정 매장 조회
        org_id = request.query_params.get('organization_id')
        if org_id:
            from users.models import Organization
            from users.filters import filter_queryset_by_role
            accessible = filter_queryset_by_role(profile, Organization.objects.all())
            if not accessible.filter(id=org_id).exists():
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            org_ids = [int(org_id)]
            org_name = accessible.get(id=org_id).name
        else:
            org_ids = [profile.organization_id]
            org_name = profile.organization.name if profile.organization else 'Unknown'

        daily_rows, totals, other_breakdown = self._aggregate_for_orgs(org_ids, start, end)

        # Previous period comparison
        prev_start, prev_end = self._prev_period(start, end)
        prev_total = self._period_total(org_ids, prev_start, prev_end)
        change_pct = 0
        if prev_total:
            change_pct = round(((totals['total_sales'] - prev_total) / prev_total) * 100, 1)

        # Sales breakdown percentages
        ts = totals['total_sales']
        card_pct = round((totals['total_card'] / ts) * 100, 1) if ts else 0
        cash_pct = round((totals['total_cash'] / ts) * 100, 1) if ts else 0
        other_pct = round((totals['total_other'] / ts) * 100, 1) if ts else 0

        # Labor metrics
        labor = self._labor_metrics(org_ids, start, end)
        days_count = totals['days_with_data']
        total_op_hours, op_per_org = self._operating_hours(org_ids, days_count)
        daily_op_hours = op_per_org.get(org_ids[0], 0) if len(org_ids) == 1 else 0

        splh = round(totals['total_sales'] / labor['total_labor_hours'], 2) if labor['total_labor_hours'] else 0
        sales_per_op_hour = round(totals['total_sales'] / total_op_hours, 2) if total_op_hours else 0
        labor_pct = round((labor['total_labor_cost'] / totals['total_sales']) * 100, 1) if totals['total_sales'] else 0

        # Enrich daily rows with labor hours & SPLH
        for row in daily_rows:
            lh = labor['per_date'].get(row['date'], 0)
            row['labor_hours'] = lh
            row['splh'] = round(row['total'] / lh, 2) if lh else 0
            row['sales_per_op_hour'] = round(row['total'] / daily_op_hours, 2) if daily_op_hours else 0

        return Response({
            'organization': {'id': org_ids[0], 'name': org_name},
            'start_date': str(start),
            'end_date': str(end),
            'kpis': {
                **totals,
                'prev_period_total': prev_total,
                'change_pct': change_pct,
                # Labor KPIs
                'total_labor_hours': labor['total_labor_hours'],
                'total_labor_cost': labor['total_labor_cost'],
                'labor_pct': labor_pct,
                'headcount': labor['headcount'],
                'splh': splh,
                'sales_per_op_hour': sales_per_op_hour,
                'daily_op_hours': daily_op_hours,
            },
            'breakdown': {
                'card_pct': card_pct,
                'cash_pct': cash_pct,
                'other_pct': other_pct,
                'other_sales_by_name': other_breakdown,
            },
            'data': daily_rows,
        })

    @action(detail=False, methods=['get'], url_path='regional',
            permission_classes=[IsAuthenticated, IsRegionalManager])
    def regional(self, request):
        """지역(Regional) 매출 분석"""
        from users.models import Organization
        profile = request.user.profile
        start, end = self._parse_dates(request)

        # Determine region
        region_id = request.query_params.get('region_id')
        if region_id:
            from users.filters import filter_queryset_by_role
            accessible = filter_queryset_by_role(profile, Organization.objects.all())
            if not accessible.filter(id=region_id).exists():
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            region = Organization.objects.get(id=region_id)
        else:
            region = profile.organization

        # Get stores under this region
        store_orgs = list(
            Organization.objects.filter(parent=region, level='STORE').values_list('id', flat=True)
        )
        if not store_orgs:
            # Maybe user's org IS a store
            if region and region.level == 'STORE':
                store_orgs = [region.id]
            else:
                store_orgs = [region.id] if region else []

        # Labor + operating hours for all stores in this region
        labor = self._labor_metrics(store_orgs, start, end)
        _, op_per_org = self._operating_hours(store_orgs, (end - start).days + 1)

        # Per-store breakdown (with labor data merged)
        store_data = self._per_org_totals(store_orgs, start, end, labor_data=labor, op_hours_data=op_per_org)

        # Regional daily totals
        daily_rows, totals, _ = self._aggregate_for_orgs(store_orgs, start, end)

        # Enrich daily rows with labor
        for row in daily_rows:
            lh = labor['per_date'].get(row['date'], 0)
            row['labor_hours'] = lh
            row['splh'] = round(row['total'] / lh, 2) if lh else 0

        # Previous period
        prev_start, prev_end = self._prev_period(start, end)
        prev_total = self._period_total(store_orgs, prev_start, prev_end)
        change_pct = 0
        if prev_total:
            change_pct = round(((totals['total_sales'] - prev_total) / prev_total) * 100, 1)

        best_store = store_data[0] if store_data else None
        ts = totals['total_sales']
        splh = round(ts / labor['total_labor_hours'], 2) if labor['total_labor_hours'] else 0
        labor_pct = round((labor['total_labor_cost'] / ts) * 100, 1) if ts else 0

        return Response({
            'region': {'id': region.id if region else None, 'name': region.name if region else 'Unknown'},
            'start_date': str(start),
            'end_date': str(end),
            'kpis': {
                **totals,
                'store_count': len(store_orgs),
                'best_store': best_store['organization'] if best_store else None,
                'prev_period_total': prev_total,
                'change_pct': change_pct,
                'total_labor_hours': labor['total_labor_hours'],
                'total_labor_cost': labor['total_labor_cost'],
                'labor_pct': labor_pct,
                'headcount': labor['headcount'],
                'splh': splh,
            },
            'stores': store_data,
            'daily_totals': daily_rows,
        })

    @action(detail=False, methods=['get'], url_path='enterprise',
            permission_classes=[IsAuthenticated, IsHQ])
    def enterprise(self, request):
        """엔터프라이즈(Enterprise) 매출 분석"""
        from users.models import Organization
        start, end = self._parse_dates(request)

        # All regions and their stores
        regions = Organization.objects.filter(level='REGION')
        all_store_ids = list(
            Organization.objects.filter(level='STORE').values_list('id', flat=True)
        )
        # Also include stores without region parent (directly under HQ)
        if not all_store_ids:
            all_store_ids = list(
                Organization.objects.exclude(level__in=['HQ', 'REGION']).values_list('id', flat=True)
            )

        # Global labor + operating hours
        labor = self._labor_metrics(all_store_ids, start, end)
        _, op_per_org = self._operating_hours(all_store_ids, (end - start).days + 1)

        # Per-region breakdown (with labor)
        region_data = []
        total_store_count = 0
        for region in regions:
            store_ids = list(
                Organization.objects.filter(parent=region, level='STORE').values_list('id', flat=True)
            )
            if not store_ids:
                continue
            total_store_count += len(store_ids)
            _, region_totals, _ = self._aggregate_for_orgs(store_ids, start, end)

            # Region-level labor
            r_labor_hours = sum(labor['per_org'].get(sid, {}).get('hours', 0) for sid in store_ids)
            r_labor_cost = sum(labor['per_org'].get(sid, {}).get('cost', 0) for sid in store_ids)
            r_headcount = len(set(
                uid for sid in store_ids
                for uid in (labor['per_org'].get(sid, {}).get('user_ids', []))
            )) or sum(labor['per_org'].get(sid, {}).get('headcount', 0) for sid in store_ids)
            r_ts = region_totals['total_sales']

            region_data.append({
                'organization': {'id': region.id, 'name': region.name},
                'store_count': len(store_ids),
                'total_sales': r_ts,
                'total_card': region_totals['total_card'],
                'total_cash': region_totals['total_cash'],
                'total_transactions': region_totals['total_transactions'],
                'avg_daily': region_totals['avg_daily'],
                'avg_ticket': round(r_ts / region_totals['total_transactions'], 2) if region_totals['total_transactions'] else 0,
                'labor_hours': round(r_labor_hours, 1),
                'labor_cost': round(r_labor_cost, 2),
                'headcount': r_headcount,
                'splh': round(r_ts / r_labor_hours, 2) if r_labor_hours else 0,
                'labor_pct': round((r_labor_cost / r_ts) * 100, 1) if r_ts else 0,
            })
        region_data.sort(key=lambda x: x['total_sales'], reverse=True)
        for i, r in enumerate(region_data):
            r['rank'] = i + 1

        # All-store ranking for enterprise comparison
        store_ranking = self._per_org_totals(all_store_ids, start, end, labor_data=labor, op_hours_data=op_per_org)

        # Enterprise daily totals
        daily_rows, totals, _ = self._aggregate_for_orgs(all_store_ids, start, end)

        # Enrich daily rows with labor
        for row in daily_rows:
            lh = labor['per_date'].get(row['date'], 0)
            row['labor_hours'] = lh
            row['splh'] = round(row['total'] / lh, 2) if lh else 0

        # Previous period
        prev_start, prev_end = self._prev_period(start, end)
        prev_total = self._period_total(all_store_ids, prev_start, prev_end)
        change_pct = 0
        if prev_total:
            change_pct = round(((totals['total_sales'] - prev_total) / prev_total) * 100, 1)

        best_region = region_data[0] if region_data else None
        ts = totals['total_sales']
        splh = round(ts / labor['total_labor_hours'], 2) if labor['total_labor_hours'] else 0
        labor_pct = round((labor['total_labor_cost'] / ts) * 100, 1) if ts else 0

        return Response({
            'start_date': str(start),
            'end_date': str(end),
            'kpis': {
                **totals,
                'region_count': len(region_data),
                'store_count': total_store_count,
                'best_region': best_region['organization'] if best_region else None,
                'prev_period_total': prev_total,
                'change_pct': change_pct,
                'total_labor_hours': labor['total_labor_hours'],
                'total_labor_cost': labor['total_labor_cost'],
                'labor_pct': labor_pct,
                'headcount': labor['headcount'],
                'splh': splh,
            },
            'regions': region_data,
            'store_ranking': store_ranking,
            'daily_totals': daily_rows,
        })

    @action(detail=False, methods=['get'], url_path='stores',
            permission_classes=[IsAuthenticated, IsManager])
    def accessible_stores(self, request):
        """현재 사용자가 접근 가능한 매장 목록 반환"""
        from users.models import Organization
        from users.filters import filter_queryset_by_role
        profile = request.user.profile

        orgs = filter_queryset_by_role(
            profile,
            Organization.objects.filter(level='STORE')
        ).values('id', 'name').order_by('name')

        return Response(list(orgs))
