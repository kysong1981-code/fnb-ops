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
import csv
import io
from decimal import Decimal, InvalidOperation
from django.db.models import Sum, Count, Avg, Case, When, CharField as DBCharField
from django.db.models.functions import Coalesce

from .models import (
    DailyClosing, ClosingHRCash, ClosingCashExpense, Supplier, SalesCategory,
    ClosingSupplierCost, ClosingOtherSale, SupplierMonthlyStatement, MonthlyClose,
    CQAccountBalance, CQExpense, CQTransaction,
    CQ_TRANSACTION_TYPE_CHOICES, CQ_ACCOUNT_TYPE_CHOICES
)
from .serializers import (
    DailyClosingListSerializer, DailyClosingDetailSerializer,
    ClosingHRCashSerializer, ClosingCashExpenseSerializer,
    ClosingSupplierCostSerializer, ClosingOtherSaleSerializer,
    SupplierSerializer, SalesCategorySerializer,
    SupplierMonthlyStatementSerializer, MonthlyCloseSerializer,
    CQAccountBalanceSerializer, CQExpenseSerializer, CQTransactionSerializer
)
from users.permissions import IsEmployee, IsManager, IsSeniorManager, IsRegionalManager, IsHQ
from users.filters import OrganizationFilterBackend, get_target_org
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
        from users.models import Organization
        profile = request.user.profile
        is_manager = profile.role in self.MANAGER_ROLES

        # Use store_id param if provided (CEO/HQ multi-store), else user's org
        store_id = request.query_params.get('store_id')
        if store_id:
            org = Organization.objects.filter(id=int(store_id)).first() or profile.organization
        else:
            org = profile.organization

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

        # Override organization in request data with the correct store
        data = request.data.copy()
        data['organization'] = org.id

        serializer = self.get_serializer(data=data)
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

        if closing.status not in ('DRAFT', 'SUBMITTED', 'APPROVED'):
            return Response(
                {'detail': f'Cannot approve. Current status: {closing.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Balance must be 0 to approve (deposit + HR cash must cover actual cash)
        hr_total = sum(e.amount for e in closing.hr_cash_entries.all())
        balance = closing.actual_cash - closing.bank_deposit - hr_total
        if balance != 0:
            return Response(
                {'detail': f'Balance must be $0.00 to approve. Current: ${balance:.2f}. Use Bank Deposit + HR Cash to cover actual cash.'},
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

        # 월별 필터 (year, month 파라미터)
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year and month:
            queryset = queryset.filter(
                daily_closing__date__year=int(year),
                daily_closing__date__month=int(month)
            )

        return queryset.select_related('daily_closing', 'created_by')

    def perform_create(self, serializer):
        """created_by를 현재 사용자로 설정"""
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def balance(self, request):
        """전체 HR Cash 누적 합계 반환 (initial balance + explicit entries + implicit from closings)"""
        from users.filters import get_target_org
        from decimal import Decimal
        org = get_target_org(request)

        # 0. Initial cash balance from Store Settings
        initial_balance = org.initial_cash_balance or Decimal('0')
        initial_date = org.initial_balance_date

        # Build date filter for entries after initial balance date
        date_filter = {}
        if initial_date:
            date_filter['daily_closing__date__gt'] = initial_date

        # 1. Explicit HR Cash entries (after initial balance date)
        explicit_qs = ClosingHRCash.objects.filter(daily_closing__organization=org, **date_filter)
        explicit_total = explicit_qs.aggregate(total=Coalesce(Sum('amount'), Decimal('0')))['total']

        # 2. Implicit: closings without HR Cash entries where actual_cash > bank_deposit
        closings_with_hr = explicit_qs.values_list('daily_closing_id', flat=True)
        implicit_qs = DailyClosing.objects.filter(organization=org)
        if initial_date:
            implicit_qs = implicit_qs.filter(date__gt=initial_date)
        implicit_total = implicit_qs.exclude(
            id__in=closings_with_hr
        ).annotate(
            remaining=F('actual_cash') - F('bank_deposit')
        ).filter(
            remaining__gt=0
        ).aggregate(total=Coalesce(Sum('remaining'), Decimal('0')))['total']

        total = initial_balance + explicit_total + implicit_total

        # 3. Cumulative cash expenses (after initial balance date)
        from closing.models import ClosingCashExpense
        expense_qs = ClosingCashExpense.objects.filter(daily_closing__organization=org)
        if initial_date:
            expense_qs = expense_qs.filter(daily_closing__date__gt=initial_date)
        total_expenses = expense_qs.aggregate(total=Coalesce(Sum('amount'), Decimal('0')))['total']

        net_balance = total - total_expenses
        return Response({
            'initial_balance': str(initial_balance),
            'initial_date': str(initial_date) if initial_date else None,
            'balance': str(total),
            'expenses': str(total_expenses),
            'net_balance': str(net_balance),
        })


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

        # 월별 필터 (year, month 파라미터)
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year and month:
            queryset = queryset.filter(
                daily_closing__date__year=int(year),
                daily_closing__date__month=int(month)
            )

        return queryset.select_related('daily_closing', 'created_by')

    def perform_create(self, serializer):
        """created_by를 현재 사용자로 설정, CQ Transaction 자동 생성"""
        expense = serializer.save(created_by=self.request.user)

        # Auto-create CQ Transaction for this expense
        try:
            closing = expense.daily_closing
            org = closing.organization
            profile = self.request.user.profile if hasattr(self.request.user, 'profile') else None

            # Determine period (H1=Apr-Sep, H2=Oct-Mar)
            m = closing.closing_date.month
            if 4 <= m <= 9:
                period_label = f"{closing.closing_date.year}-Apr"
            elif m >= 10:
                period_label = f"{closing.closing_date.year}-Oct"
            else:
                period_label = f"{closing.closing_date.year - 1}-Oct"

            CQTransaction.objects.create(
                organization=org,
                date=closing.closing_date,
                store_name=org.name,
                transaction_type='COLLECTION',
                person=expense.reason or expense.category,  # ChCh, QT, Manager
                amount=expense.amount,
                account_type='CASH',
                note=expense.notes or f"[Cash Mgmt] {expense.category} - {expense.notes}" if expense.notes else f"[Cash Mgmt] {expense.category} from {org.name}",
                period=period_label,
                created_by=profile,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"CQ auto-create failed: {e}")  # Log errors for debugging

    def perform_destroy(self, instance):
        """삭제 시 연결된 CQ Transaction도 삭제"""
        try:
            closing = instance.daily_closing
            cq = CQTransaction.objects.filter(
                organization=closing.organization,
                date=closing.closing_date,
                transaction_type__in=['COLLECTION', 'TRANSFER'],
                person=instance.reason or instance.category,
                amount=instance.amount,
            ).first()
            if cq:
                cq.delete()
        except Exception:
            pass
        instance.delete()


class SupplierViewSet(viewsets.ModelViewSet):
    """공급사 관리 ViewSet — 조회는 전 직원, 생성/수정/삭제는 매니저"""
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsManager()]

    def perform_create(self, serializer):
        serializer.save(organization=get_target_org(self.request))

    def perform_update(self, serializer):
        serializer.save()


class SalesCategoryViewSet(viewsets.ModelViewSet):
    """매출 카테고리 관리 ViewSet — 조회는 전 직원, 생성/수정/삭제는 매니저"""
    queryset = SalesCategory.objects.all()
    serializer_class = SalesCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsManager()]

    def perform_create(self, serializer):
        serializer.save(organization=get_target_org(self.request))


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
            org = get_target_org(self.request)
            queryset = queryset.filter(closing__organization=org)
        except Exception:
            queryset = queryset.none()

        closing_id = self.request.query_params.get('closing_id')
        if closing_id:
            queryset = queryset.filter(closing_id=closing_id)

        # Date range filter for COGS view
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(closing__closing_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(closing__closing_date__lte=date_to)

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

        # Parse statement with Claude Vision API
        try:
            from closing.services import parse_statement
            file_path = instance.statement_file.path
            file_ext = file_path.rsplit('.', 1)[-1].lower()
            parsed = parse_statement(file_path, file_ext)

            if parsed:
                instance.parsed_data = {
                    'total': float(parsed['total']),
                    'line_items': parsed.get('line_items', []),
                }
                # Auto-fill statement_total from Vision if not manually provided
                if parsed['total'] > 0 and (not instance.statement_total or instance.statement_total == 0):
                    instance.statement_total = parsed['total']
                instance.save()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Vision parsing failed: {e}")

        instance.reconcile()

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        """재대사 실행"""
        statement = self.get_object()
        statement.reconcile()
        serializer = self.get_serializer(statement)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def comparison(self, request, pk=None):
        """항목별 대조 결과 반환"""
        from closing.services import compare_entries
        from datetime import date as date_cls

        statement = self.get_object()

        # Get our entries for this supplier/month
        start_date = date_cls(statement.year, statement.month, 1)
        if statement.month == 12:
            end_date = date_cls(statement.year + 1, 1, 1)
        else:
            end_date = date_cls(statement.year, statement.month + 1, 1)

        our_costs = ClosingSupplierCost.objects.filter(
            closing__organization=statement.organization,
            supplier=statement.supplier,
            closing__closing_date__gte=start_date,
            closing__closing_date__lt=end_date,
        ).select_related('closing')

        our_entries = [{
            'id': c.id,
            'date': str(c.closing.closing_date),
            'amount': float(c.amount),
            'invoice_number': c.invoice_number or '',
            'description': c.description or '',
        } for c in our_costs]

        result = compare_entries(statement.parsed_data, our_entries)
        result['statement_id'] = statement.id
        result['supplier_name'] = statement.supplier.name
        result['status'] = statement.status

        return Response(result)


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


class CQTransactionViewSet(viewsets.ModelViewSet):
    """CQ 거래 내역 ViewSet - 매장↔사람 돈의 흐름"""
    queryset = CQTransaction.objects.all()
    serializer_class = CQTransactionSerializer
    permission_classes = [IsAuthenticated, IsSeniorManager]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def get_object(self):
        """CEO/HQ can access any transaction regardless of store_id filter."""
        profile = self.request.user.profile
        if profile.role in ('CEO', 'HQ'):
            pk = self.kwargs.get(self.lookup_field)
            obj = CQTransaction.objects.get(pk=pk)
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()

    def get_queryset(self):
        # CEO/HQ can see all orgs' transactions
        profile = self.request.user.profile
        if profile.role in ('CEO', 'HQ'):
            qs = CQTransaction.objects.all()
        else:
            qs = super().get_queryset()
        # Filters
        store = self.request.query_params.get('store_name')
        person = self.request.query_params.get('person')
        tx_type = self.request.query_params.get('transaction_type')
        date_start = self.request.query_params.get('date_start')
        date_end = self.request.query_params.get('date_end')
        period = self.request.query_params.get('period')

        if store:
            qs = qs.filter(store_name__icontains=store)
        if person:
            qs = qs.filter(person__icontains=person)
        if tx_type:
            qs = qs.filter(transaction_type=tx_type)
        if date_start:
            qs = qs.filter(date__gte=date_start)
        if date_end:
            qs = qs.filter(date__lte=date_end)
        if period:
            qs = qs.filter(period=period)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.profile.organization,
            created_by=self.request.user.profile,
        )

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Transaction summary - collection/distribution/expense totals"""
        from django.db.models import Q

        qs = self.get_queryset()

        # Overall totals
        totals = qs.aggregate(
            collection=Sum('amount', filter=Q(transaction_type='COLLECTION')),
            collection_account=Sum('amount', filter=Q(transaction_type='COLLECTION', account_type='ACCOUNT')),
            collection_cash=Sum('amount', filter=Q(transaction_type='COLLECTION', account_type='CASH')),
            incentive=Sum('amount', filter=Q(transaction_type='INCENTIVE')),
            profit=Sum('amount', filter=Q(transaction_type='PROFIT')),
            expense=Sum('amount', filter=Q(transaction_type='EXPENSE')),
            exchange=Sum('amount', filter=Q(transaction_type='EXCHANGE')),
        )
        for k in totals:
            totals[k] = totals[k] or 0

        # Per-store summary — only registered stores
        from users.models import Organization
        registered_stores = set(Organization.objects.values_list('name', flat=True))
        store_rows = qs.exclude(store_name='').filter(
            store_name__in=registered_stores
        ).values('store_name').annotate(
            cash_collection=Sum('amount', filter=Q(transaction_type='COLLECTION', profit_share__isnull=True)),
            owner_profit=Sum('amount', filter=Q(transaction_type='COLLECTION', profit_share__isnull=False)),
            owner_profit_account=Sum('amount', filter=Q(transaction_type='COLLECTION', profit_share__isnull=False, account_type='ACCOUNT')),
            owner_profit_cash=Sum('amount', filter=Q(transaction_type='COLLECTION', profit_share__isnull=False, account_type='CASH')),
            incentive=Sum('amount', filter=Q(transaction_type='INCENTIVE')),
            equity_share=Sum('amount', filter=Q(transaction_type='PROFIT')),
        ).order_by('store_name')

        store_summary = []
        for row in store_rows:
            cc = row['cash_collection'] or 0
            op = row['owner_profit'] or 0
            op_acct = row['owner_profit_account'] or 0
            op_cash = row['owner_profit_cash'] or 0
            i = row['incentive'] or 0
            eq = row['equity_share'] or 0
            store_summary.append({
                'store_name': row['store_name'],
                'cash_collection': cc,
                'owner_profit': op,
                'owner_profit_account': op_acct,
                'owner_profit_cash': op_cash,
                'incentive': i,
                'equity': eq,
                'total': float(cc) + float(op) + float(i) + float(eq),
            })
        store_summary.sort(key=lambda x: x['total'], reverse=True)

        # Per-person summary (grouped by person using annotate - guaranteed no duplicates)
        person_rows = qs.exclude(person='').values('person').annotate(
            incentive=Sum('amount', filter=Q(transaction_type='INCENTIVE')),
            profit=Sum('amount', filter=Q(transaction_type='PROFIT')),
            collection=Sum('amount', filter=Q(transaction_type='COLLECTION')),
            expense=Sum('amount', filter=Q(transaction_type='EXPENSE')),
        ).order_by('person')

        person_summary = []
        for row in person_rows:
            inc = row['incentive'] or 0
            prf = row['profit'] or 0
            col = row['collection'] or 0
            exp = row['expense'] or 0
            person_summary.append({
                'person': row['person'],
                'total_received': float(inc) + float(prf) + float(col),
                'total_expense': exp,
                'by_type': {
                    'incentive': inc,
                    'profit': prf,
                    'collection': col,
                }
            })
        person_summary.sort(key=lambda x: x['total_received'], reverse=True)

        return Response({
            'totals': {
                **totals,
                'net': float(totals['collection']) - float(totals['incentive']) - float(totals['profit']) - float(totals['expense']) - float(totals['exchange']),
            },
            'stores': store_summary,
            'persons': person_summary,
        })

    @action(detail=False, methods=['get'], url_path='personal-ledger')
    def personal_ledger(self, request):
        """개인 장부 - 특정 사람의 수입/지출 내역"""
        person = request.query_params.get('person')
        if not person:
            return Response(
                {'detail': 'person parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        qs = self.get_queryset().filter(person__icontains=person).order_by('date', 'created_at')

        # QT/ChCh/KRW are cash accounts — inflow = COLLECTION/BALANCE/TRANSFER, outflow = rest
        is_cash_account = person.upper() in ('QT', 'CHCH', 'KRW')
        if is_cash_account:
            inflow_types = ('COLLECTION', 'BALANCE', 'TRANSFER')
        else:
            inflow_types = ('COLLECTION', 'INCENTIVE', 'PROFIT')

        ledger = []
        balance = Decimal('0')
        for tx in qs:
            if tx.transaction_type in inflow_types:
                balance += tx.amount
                ledger.append({
                    'id': tx.id,
                    'date': tx.date,
                    'income': float(tx.amount),
                    'expense': 0,
                    'note': tx.note or f"{tx.store_name} {tx.get_transaction_type_display()}",
                    'store_name': tx.store_name,
                    'transaction_type': tx.transaction_type,
                    'account_type': tx.account_type,
                    'balance': float(balance),
                })
            else:
                balance -= tx.amount
                ledger.append({
                    'id': tx.id,
                    'date': tx.date,
                    'income': 0,
                    'expense': float(tx.amount),
                    'note': tx.note or f"{tx.store_name} {tx.get_transaction_type_display()}",
                    'store_name': tx.store_name,
                    'transaction_type': tx.transaction_type,
                    'account_type': tx.account_type,
                    'balance': float(balance),
                })

        # Reverse ledger so most recent appears first
        ledger.reverse()

        return Response({
            'person': person,
            'ledger': ledger,
            'total_income': sum(item['income'] for item in ledger),
            'total_expense': sum(item['expense'] for item in ledger),
            'balance': float(balance),
        })

    @action(detail=False, methods=['get'], url_path='store-ledger')
    def store_ledger(self, request):
        """매장 장부 - 특정 매장의 수금/배분 내역 (이월 잔액 포함)"""
        store = request.query_params.get('store_name')
        if not store:
            return Response(
                {'detail': 'store_name parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        date_start = request.query_params.get('date_start')
        date_end = request.query_params.get('date_end')

        # CEO/HQ: all orgs
        profile = request.user.profile
        if profile.role in ('CEO', 'HQ'):
            all_qs = CQTransaction.objects.filter(store_name__icontains=store)
        else:
            all_qs = CQTransaction.objects.filter(
                organization=profile.organization,
                store_name__icontains=store
            )

        # Calculate carry-over balance from transactions BEFORE the period
        carry_over = Decimal('0')
        if date_start:
            before_qs = all_qs.filter(date__lt=date_start).order_by('date', 'created_at')
            for tx in before_qs:
                if tx.transaction_type in ('COLLECTION', 'BALANCE'):
                    carry_over += tx.amount
                else:
                    carry_over -= tx.amount

        # Current period transactions
        period_qs = all_qs.order_by('date', 'created_at')
        if date_start:
            period_qs = period_qs.filter(date__gte=date_start)
        if date_end:
            period_qs = period_qs.filter(date__lte=date_end)

        ledger = []
        balance = carry_over
        for tx in period_qs:
            if tx.transaction_type in ('COLLECTION', 'BALANCE'):
                balance += tx.amount
                ledger.append({
                    'id': tx.id,
                    'date': tx.date,
                    'income': float(tx.amount),
                    'expense': 0,
                    'person': tx.person,
                    'note': tx.note or tx.get_transaction_type_display(),
                    'transaction_type': tx.transaction_type,
                    'account_type': tx.account_type,
                    'is_locked': tx.is_locked,
                    'balance': float(balance),
                })
            else:
                balance -= tx.amount
                ledger.append({
                    'id': tx.id,
                    'date': tx.date,
                    'income': 0,
                    'expense': float(tx.amount),
                    'person': tx.person,
                    'note': tx.note or tx.get_transaction_type_display(),
                    'transaction_type': tx.transaction_type,
                    'account_type': tx.account_type,
                    'is_locked': tx.is_locked,
                    'balance': float(balance),
                })

        # Reverse ledger so most recent appears first
        ledger.reverse()

        return Response({
            'store_name': store,
            'carry_over': float(carry_over),
            'ledger': ledger,
            'total_collection': sum(item['income'] for item in ledger),
            'total_distributed': sum(item['expense'] for item in ledger),
            'balance': float(balance),
        })

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        """Period-based history for year-over-year comparison.
        Returns data grouped by year and H1/H2 period with per-store breakdown."""
        qs = self.get_queryset()

        # Collect all unique periods from the data
        periods = list(qs.exclude(period='').values_list('period', flat=True).distinct().order_by('period'))

        # Only registered stores
        from users.models import Organization
        registered_stores = set(Organization.objects.values_list('name', flat=True))

        # Build owner profit account/cash breakdown from ProfitShare model
        from reports.models import ProfitShare
        from django.db.models import Q
        from collections import defaultdict

        # Pre-calculate owner account/cash per period from ProfitShare
        all_locked_ps = ProfitShare.objects.filter(is_locked=True).prefetch_related('partners')
        ps_by_period = defaultdict(list)
        for ps in all_locked_ps:
            if ps.period_type == 'H1':
                plabel = f"{ps.year}-Oct"
            else:
                plabel = f"{ps.year + 1}-Apr"
            ps_by_period[plabel].append(ps)

        # Aggregate all period totals in fewer queries
        from django.db.models import Case, When, Value, BooleanField
        period_agg = qs.exclude(period='').values('period').annotate(
            owner_profit=Sum('amount', filter=Q(transaction_type='COLLECTION', profit_share__isnull=False)),
            cash_collection=Sum('amount', filter=Q(transaction_type='COLLECTION', profit_share__isnull=True)),
            incentive=Sum('amount', filter=Q(transaction_type='INCENTIVE')),
            equity=Sum('amount', filter=Q(transaction_type='PROFIT')),
        ).order_by('period')

        period_totals = {r['period']: r for r in period_agg}

        # Per-store per-period aggregates (only registered stores)
        store_period_agg = qs.exclude(period='').filter(
            store_name__in=registered_stores
        ).values('period', 'store_name').annotate(
            owner_profit=Sum('amount', filter=Q(transaction_type='COLLECTION', profit_share__isnull=False)),
            incentive=Sum('amount', filter=Q(transaction_type='INCENTIVE')),
            equity=Sum('amount', filter=Q(transaction_type='PROFIT')),
        ).order_by('period', 'store_name')

        # Group store data by period
        store_by_period = defaultdict(list)
        for r in store_period_agg:
            op = float(r['owner_profit'] or 0)
            inc = float(r['incentive'] or 0)
            eq = float(r['equity'] or 0)
            if op > 0 or inc > 0 or eq > 0:
                store_by_period[r['period']].append({
                    'store_name': r['store_name'],
                    'owner_profit': op,
                    'incentive': inc,
                    'equity': eq,
                })

        # Per-store owner account/cash from ProfitShare
        store_acct_cash = defaultdict(lambda: {'owner_account': Decimal('0'), 'owner_cash': Decimal('0')})
        for period_label, ps_list in ps_by_period.items():
            for ps in ps_list:
                store_name = ps.organization.name if ps.organization else None
                if not store_name or store_name not in registered_stores:
                    continue
                has_owner = any(p.partner_type == 'OWNER' for p in ps.partners.all())
                if has_owner:
                    for p in ps.partners.all():
                        if p.partner_type == 'OWNER':
                            store_acct_cash[(period_label, store_name)]['owner_account'] += (p.bank_account or Decimal('0'))
                            store_acct_cash[(period_label, store_name)]['owner_cash'] += (p.bank_cash or Decimal('0'))
                else:
                    total_p_acct = sum((p.total_account or Decimal('0')) for p in ps.partners.all())
                    total_p_cash = sum((p.total_cash or Decimal('0')) for p in ps.partners.all())
                    store_acct_cash[(period_label, store_name)]['owner_account'] += (ps.net_profit_account or Decimal('0')) - total_p_acct
                    store_acct_cash[(period_label, store_name)]['owner_cash'] += (ps.net_profit_cash or Decimal('0')) - total_p_cash

        # Build period data
        history_data = []
        for period_label in periods:
            row = period_totals.get(period_label, {})
            owner_profit = float(row.get('owner_profit') or 0)
            cash_collection = float(row.get('cash_collection') or 0)
            incentive = float(row.get('incentive') or 0)
            equity = float(row.get('equity') or 0)

            # Owner account/cash from ProfitShare
            owner_account = Decimal('0')
            owner_cash = Decimal('0')
            for ps in ps_by_period.get(period_label, []):
                has_owner = any(p.partner_type == 'OWNER' for p in ps.partners.all())
                if has_owner:
                    for p in ps.partners.all():
                        if p.partner_type == 'OWNER':
                            owner_account += (p.bank_account or Decimal('0'))
                            owner_cash += (p.bank_cash or Decimal('0'))
                else:
                    total_p_acct = sum((p.total_account or Decimal('0')) for p in ps.partners.all())
                    total_p_cash = sum((p.total_cash or Decimal('0')) for p in ps.partners.all())
                    owner_account += (ps.net_profit_account or Decimal('0')) - total_p_acct
                    owner_cash += (ps.net_profit_cash or Decimal('0')) - total_p_cash

            # Add per-store account/cash to store data
            stores = store_by_period.get(period_label, [])
            for s in stores:
                skey = (period_label, s['store_name'])
                s['owner_account'] = float(store_acct_cash[skey]['owner_account'])
                s['owner_cash'] = float(store_acct_cash[skey]['owner_cash'])

            history_data.append({
                'period': period_label,
                'owner_profit': owner_profit,
                'owner_account': float(owner_account),
                'owner_cash': float(owner_cash),
                'cash_collection': cash_collection,
                'incentive': incentive,
                'equity': equity,
                'stores': stores,
            })

        return Response(history_data)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.is_locked:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('This transaction is locked and cannot be edited.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.is_locked:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('This transaction is locked and cannot be deleted.')
        instance.delete()

    @action(detail=False, methods=['post'], url_path='toggle-lock')
    def toggle_lock(self, request):
        """Lock/unlock CQ transactions for a store+period.
        Body: { store_name, period }
        Only the person who locked can unlock (or CEO)."""
        store_name = request.data.get('store_name')
        period = request.data.get('period')
        if not store_name:
            return Response({'error': 'store_name is required'}, status=status.HTTP_400_BAD_REQUEST)

        qs = self.get_queryset().filter(store_name=store_name)
        if period:
            qs = qs.filter(period=period)

        profile = request.user.profile
        first_locked = qs.filter(is_locked=True).first()

        if first_locked:
            # Unlock - only the person who locked or CEO
            if first_locked.locked_by != profile and profile.role != 'CEO':
                return Response(
                    {'error': f'Only {first_locked.locked_by.user.get_full_name()} or CEO can unlock.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            count = qs.update(is_locked=False, locked_by=None)
            return Response({'status': 'unlocked', 'count': count})
        else:
            # Lock
            count = qs.update(is_locked=True, locked_by=profile)
            return Response({
                'status': 'locked',
                'count': count,
                'locked_by': profile.user.get_full_name(),
            })

    @action(detail=False, methods=['get'], url_path='lock-status')
    def lock_status(self, request):
        """Check lock status for a store+period."""
        store_name = request.query_params.get('store_name')
        period = request.query_params.get('period')
        if not store_name:
            return Response({'is_locked': False})

        qs = self.get_queryset().filter(store_name=store_name)
        if period:
            qs = qs.filter(period=period)

        locked_tx = qs.filter(is_locked=True).first()
        if locked_tx:
            locked_by_name = ''
            if locked_tx.locked_by and locked_tx.locked_by.user:
                locked_by_name = locked_tx.locked_by.user.get_full_name()
            return Response({
                'is_locked': True,
                'locked_by_name': locked_by_name,
            })
        return Response({'is_locked': False})

    @action(detail=False, methods=['get'], url_path='account-statement')
    def account_statement(self, request):
        """Account statement for QT/ChCh/KRW - shows all incoming money by store and month."""
        account = request.query_params.get('account')  # QT, ChCh, KRW
        if not account:
            return Response({'error': 'account parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        # Use base queryset (bypass get_queryset date filters for carry-over calc)
        all_qs = CQTransaction.objects.filter(person__iexact=account)

        # Optional date range filter
        date_start = request.query_params.get('date_start')
        date_end = request.query_params.get('date_end')

        # For account statement: COLLECTION, BALANCE, TRANSFER are all inflows
        INFLOW_TYPES = ('COLLECTION', 'BALANCE', 'TRANSFER')

        # Calculate carry-over balance from ALL transactions before date_start
        opening_balance = Decimal('0')
        if date_start:
            prev_qs = all_qs.filter(date__lt=date_start).order_by('date', 'created_at')
            for tx in prev_qs:
                if tx.transaction_type in INFLOW_TYPES:
                    opening_balance += tx.amount
                else:
                    opening_balance -= tx.amount

        # Filter to period
        qs = all_qs
        if date_start:
            qs = qs.filter(date__gte=date_start)
        if date_end:
            qs = qs.filter(date__lte=date_end)

        qs = qs.order_by('date', 'created_at')

        # Running balance ledger (calculated in chronological order)
        ledger = []
        balance = opening_balance
        for tx in qs:
            # Cash management auto-created entries have [Cash Mgmt] in note
            source = 'cash_management' if (tx.note and '[Cash Mgmt]' in tx.note) else None
            entry = {
                'id': tx.id, 'date': str(tx.date),
                'store_name': tx.store_name,
                'note': tx.note,
                'transaction_type': tx.transaction_type,
                'period': tx.period,
                'is_locked': tx.is_locked,
            }
            if source:
                entry['source'] = source
            if tx.transaction_type in INFLOW_TYPES:
                balance += tx.amount
                entry['amount'] = float(tx.amount)
            else:
                balance -= tx.amount
                entry['amount'] = -float(tx.amount)
            entry['balance'] = float(balance)
            ledger.append(entry)

        # Merge CQExpense (standalone approved expenses) from 2025-10-01 onwards
        # NOTE: ClosingCashExpense already auto-creates CQTransaction on perform_create,
        # so we do NOT merge them here to avoid duplicates.
        from closing.models import CQExpense
        from datetime import date as dt_date
        expense_cutoff = dt_date(2025, 10, 1)

        cq_expense_qs = CQExpense.objects.filter(
            account=account.upper(),
            date__gte=expense_cutoff,
            status='APPROVED',
        )

        if date_start and dt_date.fromisoformat(date_start) > expense_cutoff:
            cq_expense_qs = cq_expense_qs.filter(date__gte=date_start)
        if date_end:
            cq_expense_qs = cq_expense_qs.filter(date__lte=date_end)

        # Opening balance adjustment for CQExpenses before date_start
        if date_start:
            prev_cq = CQExpense.objects.filter(
                account=account.upper(), date__gte=expense_cutoff,
                date__lt=date_start, status='APPROVED',
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            opening_balance -= prev_cq

        # Build merged entries
        all_entries = []
        for item in ledger:
            all_entries.append(('tx', item))

        for exp in cq_expense_qs.order_by('date', 'created_at'):
            all_entries.append(('expense', {
                'id': f'exp_{exp.id}',
                'date': str(exp.date),
                'store_name': exp.get_category_display() if exp.category else '',
                'amount': -float(exp.amount),
                'note': f"[CQ Expense] {exp.description}",
                'transaction_type': exp.category or 'EXPENSE',
                'period': '',
                'is_locked': True,
                'source': 'cq_expense',
            }))

        if cq_expense_qs.exists():
            # Re-sort by date and recalculate running balance
            all_entries.sort(key=lambda x: x[1]['date'])
            ledger = []
            balance = opening_balance
            for entry_type, item in all_entries:
                balance += Decimal(str(item['amount']))
                item['balance'] = float(balance)
                ledger.append(item)

        # Reverse ledger so most recent appears first
        ledger.reverse()

        # Registered store names for filtering
        from users.models import Organization
        registered_stores = set(
            Organization.objects.values_list('name', flat=True)
        )

        # Monthly summary — only registered stores
        from collections import defaultdict
        monthly = defaultdict(lambda: {'total': Decimal('0'), 'stores': defaultdict(Decimal)})
        for tx in qs:
            if tx.store_name and tx.store_name in registered_stores:
                month_key = tx.date.strftime('%Y-%m')
                amt = tx.amount if tx.transaction_type in INFLOW_TYPES else -tx.amount
                monthly[month_key]['total'] += amt
                monthly[month_key]['stores'][tx.store_name] += amt

        monthly_summary = []
        for month_key in sorted(monthly.keys()):
            data = monthly[month_key]
            stores = [{'store_name': s, 'amount': float(a)} for s, a in sorted(data['stores'].items())]
            monthly_summary.append({
                'month': month_key,
                'total': float(data['total']),
                'stores': stores,
            })

        # Per-store summary — only registered stores
        store_totals = defaultdict(Decimal)
        for tx in qs:
            if tx.store_name and tx.store_name in registered_stores:
                amt = tx.amount if tx.transaction_type in INFLOW_TYPES else -tx.amount
                store_totals[tx.store_name] += amt
        store_summary = [{'store_name': s, 'total': float(t)} for s, t in sorted(store_totals.items(), key=lambda x: -x[1])]

        # Actual balance from CQAccountBalance
        from closing.models import CQAccountBalance
        actual_balance = None
        try:
            acct_bal = CQAccountBalance.objects.get(account=account.upper())
            actual_balance = float(acct_bal.balance)
        except CQAccountBalance.DoesNotExist:
            pass

        return Response({
            'account': account,
            'opening_balance': float(opening_balance),
            'total_balance': float(balance),
            'actual_balance': actual_balance,
            'transaction_count': len(ledger),
            'ledger': ledger,
            'monthly_summary': monthly_summary,
            'store_summary': store_summary,
        })

    @action(detail=False, methods=['get'], url_path='stores-list')
    def stores_list(self, request):
        """등록된 매장명 목록"""
        qs = self.get_queryset()
        stores = list(qs.exclude(store_name='').values_list('store_name', flat=True).distinct().order_by('store_name'))
        return Response({'stores': stores})

    @action(detail=False, methods=['get'], url_path='persons-list')
    def persons_list(self, request):
        """등록된 사람 목록"""
        qs = self.get_queryset()
        persons = list(qs.exclude(person='').values_list('person', flat=True).distinct().order_by('person'))
        return Response({'persons': persons})

    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        """CSV 파일로 거래 일괄 등록"""
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'detail': 'CSV file is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            content = file.read().decode('utf-8-sig')  # BOM 처리
        except UnicodeDecodeError:
            try:
                file.seek(0)
                content = file.read().decode('euc-kr')
            except UnicodeDecodeError:
                return Response(
                    {'detail': 'File encoding not supported. Use UTF-8 or EUC-KR.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        reader = csv.DictReader(io.StringIO(content))
        org = request.user.profile.organization
        profile = request.user.profile

        valid_types = dict(CQ_TRANSACTION_TYPE_CHOICES).keys()
        valid_account_types = dict(CQ_ACCOUNT_TYPE_CHOICES).keys()

        created = []
        errors = []

        for i, row in enumerate(reader, start=2):  # Row 2 = first data row
            try:
                # Required fields
                date_str = row.get('date', '').strip()
                tx_type = row.get('type', '').strip().upper()
                amount_str = row.get('amount', '').strip()

                if not date_str or not amount_str:
                    errors.append(f"Row {i}: date and amount are required")
                    continue

                if tx_type not in valid_types:
                    errors.append(f"Row {i}: invalid type '{tx_type}'. Use: {', '.join(valid_types)}")
                    continue

                try:
                    amount = Decimal(amount_str.replace(',', ''))
                except (InvalidOperation, ValueError):
                    errors.append(f"Row {i}: invalid amount '{amount_str}'")
                    continue

                account_type = row.get('account_type', 'CASH').strip().upper()
                if account_type not in valid_account_types:
                    account_type = 'CASH'

                tx = CQTransaction.objects.create(
                    organization=org,
                    date=date_str,
                    store_name=row.get('store', '').strip(),
                    transaction_type=tx_type,
                    person=row.get('person', '').strip(),
                    amount=amount,
                    account_type=account_type,
                    note=row.get('note', '').strip(),
                    period=row.get('period', '').strip(),
                    incentive_rate=Decimal(row['incentive_rate']) if row.get('incentive_rate', '').strip() else None,
                    created_by=profile,
                )
                created.append(tx.id)

            except Exception as e:
                errors.append(f"Row {i}: {str(e)}")

        return Response({
            'created_count': len(created),
            'error_count': len(errors),
            'errors': errors[:20],  # Max 20 errors shown
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        """거래 내역 CSV 내보내기"""
        from django.http import HttpResponse

        qs = self.get_queryset()

        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="cq_transactions.csv"'
        response.write('\ufeff')  # BOM for Excel

        writer = csv.writer(response)
        writer.writerow(['date', 'store', 'type', 'person', 'amount', 'account_type', 'note', 'period', 'incentive_rate'])

        for tx in qs:
            writer.writerow([
                tx.date, tx.store_name, tx.transaction_type,
                tx.person, tx.amount, tx.account_type,
                tx.note, tx.period, tx.incentive_rate or '',
            ])

        return response

    @action(detail=False, methods=['delete'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """기간별 일괄 삭제"""
        date_start = request.query_params.get('date_start')
        date_end = request.query_params.get('date_end')

        if not date_start or not date_end:
            return Response(
                {'detail': 'date_start and date_end are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        qs = self.get_queryset().filter(date__gte=date_start, date__lte=date_end)
        count = qs.count()
        qs.delete()

        return Response({'deleted_count': count})


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

        # Last year same period comparison
        from dateutil.relativedelta import relativedelta
        ly_start = start - relativedelta(years=1)
        ly_end = end - relativedelta(years=1)
        ly_total = self._period_total(org_ids, ly_start, ly_end)
        ly_change_pct = 0
        if ly_total:
            ly_change_pct = round(((totals['total_sales'] - ly_total) / ly_total) * 100, 1)

        # Previous month comparison
        pm_start = start - relativedelta(months=1)
        pm_end = end - relativedelta(months=1)
        pm_total = self._period_total(org_ids, pm_start, pm_end)
        pm_change_pct = 0
        if pm_total:
            pm_change_pct = round(((totals['total_sales'] - pm_total) / pm_total) * 100, 1)

        # Target data
        from users.models import Organization
        org = Organization.objects.filter(id=org_ids[0]).first()
        monthly_target = float(org.monthly_revenue_target) if org and org.monthly_revenue_target else None
        labour_target = float(org.labour_cost_target) if org else 30.0
        target_pct = None
        if monthly_target and monthly_target > 0:
            target_pct = round((totals['total_sales'] / monthly_target) * 100, 1)

        # Per-KPI comparisons — full aggregation for prev month + last year
        prev_avg_daily = (pm_total / max((pm_end - pm_start).days + 1, 1)) if pm_total else None
        ly_avg_daily = (ly_total / max((ly_end - ly_start).days + 1, 1)) if ly_total else None

        # Full prev month aggregation
        _, pm_totals, _ = self._aggregate_for_orgs(org_ids, pm_start, pm_end)
        pm_labor = self._labor_metrics(org_ids, pm_start, pm_end)
        pm_splh = round(pm_totals['total_sales'] / pm_labor['total_labor_hours'], 2) if pm_labor['total_labor_hours'] else 0
        pm_labor_pct = round((pm_labor['total_labor_cost'] / pm_totals['total_sales']) * 100, 1) if pm_totals['total_sales'] else 0

        # Full last year aggregation
        _, ly_totals, _ = self._aggregate_for_orgs(org_ids, ly_start, ly_end)
        ly_labor = self._labor_metrics(org_ids, ly_start, ly_end)
        ly_splh = round(ly_totals['total_sales'] / ly_labor['total_labor_hours'], 2) if ly_labor['total_labor_hours'] else 0
        ly_labor_pct = round((ly_labor['total_labor_cost'] / ly_totals['total_sales']) * 100, 1) if ly_totals['total_sales'] else 0

        return Response({
            'organization': {'id': org_ids[0], 'name': org_name},
            'start_date': str(start),
            'end_date': str(end),
            'kpis': {
                **totals,
                'prev_period_total': prev_total,
                'change_pct': change_pct,
                # Previous month
                'prev_month_total': pm_total,
                'prev_month_pct': pm_change_pct,
                'prev_month_avg_daily': prev_avg_daily,
                'prev_month_transactions': pm_totals['total_transactions'],
                'prev_month_splh': pm_splh,
                'prev_month_labor_hours': pm_labor['total_labor_hours'],
                'prev_month_labor_cost': pm_labor['total_labor_cost'],
                'prev_month_labor_pct': pm_labor_pct,
                'prev_month_sales_per_op_hour': round(pm_totals['total_sales'] / total_op_hours, 2) if total_op_hours else 0,
                # Last year
                'last_year_total': ly_total,
                'last_year_pct': ly_change_pct,
                'last_year_avg_daily': ly_avg_daily,
                'last_year_transactions': ly_totals['total_transactions'],
                'last_year_splh': ly_splh,
                'last_year_labor_hours': ly_labor['total_labor_hours'],
                'last_year_labor_cost': ly_labor['total_labor_cost'],
                'last_year_labor_pct': ly_labor_pct,
                # Targets
                'monthly_target': monthly_target,
                'target_pct': target_pct,
                'labour_target': labour_target,
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

    @action(detail=False, methods=['get'], url_path='compare',
            permission_classes=[IsAuthenticated, IsManager])
    def compare(self, request):
        """Multi-store comparison — daily breakdown per store."""
        from users.models import Organization
        from users.filters import filter_queryset_by_role
        profile = request.user.profile
        start, end = self._parse_dates(request)

        store_ids_param = request.query_params.get('store_ids', '')
        if store_ids_param:
            store_ids = [int(x) for x in store_ids_param.split(',') if x.strip()]
        else:
            accessible = filter_queryset_by_role(profile, Organization.objects.all())
            store_ids = list(accessible.values_list('id', flat=True))

        # Validate access
        accessible = filter_queryset_by_role(profile, Organization.objects.all())
        store_ids = [sid for sid in store_ids if accessible.filter(id=sid).exists()]

        if not store_ids:
            return Response({'stores': [], 'daily_comparison': []})

        labor = self._labor_metrics(store_ids, start, end)
        _, op_hours = self._operating_hours(store_ids, (end - start).days + 1)
        per_store = self._per_org_totals(store_ids, start, end, labor_data=labor, op_hours_data=op_hours)

        # Daily data per store for chart overlay
        daily_by_store = {}
        for sid in store_ids:
            rows, _, _ = self._aggregate_for_orgs([sid], start, end)
            store_name = Organization.objects.filter(id=sid).values_list('name', flat=True).first() or str(sid)
            daily_by_store[sid] = {
                'store_id': sid,
                'store_name': store_name,
                'daily': rows,
            }

        # Build comparison: each date has all stores' totals
        all_dates = sorted(set(
            r['date'] for store_data in daily_by_store.values() for r in store_data['daily']
        ))
        daily_comparison = []
        for d in all_dates:
            entry = {'date': d}
            for sid, store_data in daily_by_store.items():
                day_row = next((r for r in store_data['daily'] if r['date'] == d), None)
                key = f"store_{sid}"
                entry[key] = day_row['total'] if day_row else 0
                entry[f"{key}_name"] = store_data['store_name']
            daily_comparison.append(entry)

        # Previous period for each store
        prev_start, prev_end = self._prev_period(start, end)
        for store in per_store:
            sid = store['organization']['id']
            prev_total = self._period_total([sid], prev_start, prev_end)
            store['prev_total'] = prev_total
            store['change_pct'] = round(((store['total_sales'] - prev_total) / prev_total) * 100, 1) if prev_total else 0

        return Response({
            'stores': per_store,
            'daily_comparison': daily_comparison,
            'store_ids': store_ids,
            'start_date': str(start),
            'end_date': str(end),
        })

    @action(detail=False, methods=['get'], url_path='ai-insights',
            permission_classes=[IsAuthenticated, IsManager])
    def ai_insights(self, request):
        """AI-powered sales analysis using Claude API."""
        profile = request.user.profile
        start, end = self._parse_dates(request)

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

        daily_rows, totals, _ = self._aggregate_for_orgs(org_ids, start, end)
        labor = self._labor_metrics(org_ids, start, end)

        # Build data for AI
        sales_data = {
            'total_sales': totals['total_sales'],
            'average_daily': totals['avg_daily'],
            'card_total': totals['total_card'],
            'cash_total': totals['total_cash'],
            'highest': max(daily_rows, key=lambda d: d['total'], default={'date': None, 'total': 0}),
            'lowest': min(daily_rows, key=lambda d: d['total'], default={'date': None, 'total': 0}),
            'trend': 'stable',
            'trend_percentage': 0,
            'data': [{'date': d['date'], 'actual_total': d['total'], 'card_sales': d['card'], 'cash_sales': d['cash']} for d in daily_rows],
            'day_of_week_avg': self._compute_dow_avg(daily_rows),
            'labor_hours': labor['total_labor_hours'],
            'labor_cost': labor['total_labor_cost'],
            'labor_pct': round((labor['total_labor_cost'] / totals['total_sales']) * 100, 1) if totals['total_sales'] else 0,
            'splh': round(totals['total_sales'] / labor['total_labor_hours'], 2) if labor['total_labor_hours'] else 0,
        }

        # Trend calculation
        if len(daily_rows) >= 2:
            mid = len(daily_rows) // 2
            first = sum(d['total'] for d in daily_rows[:mid])
            second = sum(d['total'] for d in daily_rows[mid:])
            if first > 0:
                pct = round(((second - first) / first) * 100, 1)
                sales_data['trend'] = 'up' if pct > 0 else 'down' if pct < 0 else 'stable'
                sales_data['trend_percentage'] = pct

        # Remap highest/lowest to match expected format
        h = sales_data['highest']
        l = sales_data['lowest']
        sales_data['highest'] = {'date': h.get('date'), 'amount': h.get('total', 0)}
        sales_data['lowest'] = {'date': l.get('date'), 'amount': l.get('total', 0)}

        from reports.services import generate_sales_insights
        insights = generate_sales_insights(sales_data, org_name, str(start), str(end))

        if insights is None:
            return Response({
                'insights': None,
                'error': 'AI analysis unavailable. ANTHROPIC_API_KEY not configured.',
            })

        return Response({
            'insights': insights,
            'generated_at': timezone.now().isoformat(),
        })

    @action(detail=False, methods=['get'], url_path='holidays',
            permission_classes=[IsAuthenticated])
    def holidays(self, request):
        """Get holidays for a date range, with sales data overlay."""
        from closing.models import Holiday
        from payroll.holidays import get_regional_anniversary
        start, end = self._parse_dates(request)
        profile = request.user.profile

        # Region-to-anniversary mapping
        REGION_ANNIVERSARY_MAP = {
            'AUCKLAND': 'Auckland Anniversary',
            'WELLINGTON': 'Wellington Anniversary',
            'NELSON': 'Nelson Anniversary',
            'OTAGO': 'Otago Anniversary',
            'SOUTHLAND': 'Southland Anniversary',
            'TARANAKI': 'Taranaki Anniversary',
            'HAWKES_BAY': "Hawke's Bay Anniversary",
            'MARLBOROUGH': 'Marlborough Anniversary',
            'CANTERBURY': 'Canterbury Anniversary',
            'WEST_COAST': 'Westland Anniversary',
            'CHATHAM_ISLANDS': 'Chatham Islands Anniversary',
        }

        org = profile.organization
        store_region = org.region if org else None
        store_anniversary = REGION_ANNIVERSARY_MAP.get(store_region, '') if store_region else ''

        # Get holidays in range, filter NZ_REGIONAL to only show store's region
        all_holidays = Holiday.objects.filter(
            start_date__lte=end,
            end_date__gte=start,
        ).values('id', 'name', 'name_ko', 'category', 'start_date', 'end_date', 'year', 'impact')

        holidays = []
        for h in all_holidays:
            if h['category'] == 'NZ_REGIONAL':
                # Only include if it matches the store's region
                if store_anniversary and h['name'] == store_anniversary:
                    holidays.append(h)
            else:
                holidays.append(h)

        # Add regional anniversary days dynamically based on store's region
        region = org.region if org else None
        if region:
            existing_names = {h['name'].lower() for h in holidays}
            years = set()
            d = start
            while d <= end:
                years.add(d.year)
                d = d.replace(year=d.year + 1, month=1, day=1) if d.month == 12 and d.day == 31 else d + timedelta(days=365)
            years.add(start.year)
            years.add(end.year)
            for yr in years:
                result = get_regional_anniversary(region, yr)
                if result:
                    actual, observed, name = result
                    if start <= observed <= end and name.lower() not in existing_names:
                        holidays.append({
                            'id': None,
                            'name': name,
                            'name_ko': f'{name} (지역 공휴일)',
                            'category': 'NZ_PUBLIC',
                            'start_date': observed,
                            'end_date': observed,
                            'year': yr,
                            'impact': 'MEDIUM',
                        })

        # Get org sales data
        org_id = request.query_params.get('organization_id')
        if org_id:
            org_ids = [int(org_id)]
        else:
            org_ids = [profile.organization_id]

        # Get daily sales for the period
        daily_rows, totals, _ = self._aggregate_for_orgs(org_ids, start, end)
        sales_by_date = {r['date']: r['total'] for r in daily_rows}

        # Compute holiday sales analysis
        result = []
        for h in holidays:
            h_start = max(h['start_date'], start)
            h_end = min(h['end_date'], end)

            # Sum sales during this holiday
            holiday_sales = []
            d = h_start
            while d <= h_end:
                s = sales_by_date.get(str(d), 0)
                if s > 0:
                    holiday_sales.append(s)
                d += timedelta(days=1)

            holiday_total = sum(holiday_sales)
            holiday_days = len(holiday_sales)
            holiday_avg = round(holiday_total / holiday_days, 2) if holiday_days else 0

            # Compare to non-holiday average
            non_holiday_sales = []
            for row in daily_rows:
                row_date = date_type.fromisoformat(row['date'])
                is_in_any_holiday = any(
                    hh['start_date'] <= row_date <= hh['end_date'] for hh in holidays
                )
                if not is_in_any_holiday and row['total'] > 0:
                    non_holiday_sales.append(row['total'])

            non_holiday_avg = round(sum(non_holiday_sales) / len(non_holiday_sales), 2) if non_holiday_sales else 0
            impact_pct = round(((holiday_avg - non_holiday_avg) / non_holiday_avg) * 100, 1) if non_holiday_avg else 0

            result.append({
                'id': h['id'],
                'name': h['name'],
                'name_ko': h['name_ko'],
                'category': h['category'],
                'start_date': str(h['start_date']),
                'end_date': str(h['end_date']),
                'impact': h['impact'],
                'total_sales': holiday_total,
                'days_with_data': holiday_days,
                'avg_daily': holiday_avg,
                'non_holiday_avg': non_holiday_avg,
                'impact_pct': impact_pct,
            })

        return Response({
            'holidays': result,
            'period_avg': totals['avg_daily'],
            'period_total': totals['total_sales'],
        })

    @action(detail=False, methods=['get'], url_path='upcoming-holidays',
            permission_classes=[IsAuthenticated])
    def upcoming_holidays(self, request):
        """Get next upcoming key holidays (Easter + School) with past 2 years' data."""
        from closing.models import Holiday, DailyClosing
        from closing.models import ClosingOtherSale
        from django.db.models import Sum
        from users.models import Organization
        from hr.models import Timesheet

        today = date_type.today()
        profile = request.user.profile
        org_id = request.query_params.get('organization_id') or request.query_params.get('store_id')
        if org_id:
            org = Organization.objects.filter(id=int(org_id)).first()
        else:
            org = profile.organization

        # Find next Easter Holiday and next School Holiday
        upcoming = Holiday.objects.filter(
            end_date__gte=today,
        ).order_by('start_date')

        target_holidays = []
        found_easter = False
        found_school = False

        for h in upcoming:
            if not found_easter and 'Easter' in h.name:
                target_holidays.append(h)
                found_easter = True
            elif not found_school and h.category == 'NZ_SCHOOL':
                target_holidays.append(h)
                found_school = True
            if found_easter and found_school:
                break

        def _get_holiday_data(past_holiday, org):
            """Get sales + staffing data for a past holiday period."""
            if not past_holiday or not org:
                return None
            ly_start = past_holiday.start_date
            ly_end = past_holiday.end_date
            ly_duration = (ly_end - ly_start).days + 1

            closings = DailyClosing.objects.filter(
                organization=org,
                closing_date__range=[ly_start, ly_end],
            )
            agg = closings.aggregate(card=Sum('actual_card'), cash=Sum('actual_cash'))
            card = float(agg['card'] or 0)
            cash = float(agg['cash'] or 0)
            other = ClosingOtherSale.objects.filter(
                closing__organization=org,
                closing__closing_date__range=[ly_start, ly_end],
            ).aggregate(total=Sum('amount'))
            total = card + cash + float(other['total'] or 0)
            days_count = closings.count()

            # Normal period comparison (2 weeks before)
            compare_start = ly_start - timedelta(days=14)
            compare_end = ly_start - timedelta(days=1)
            compare_closings = DailyClosing.objects.filter(
                organization=org, closing_date__range=[compare_start, compare_end],
            )
            c_agg = compare_closings.aggregate(card=Sum('actual_card'), cash=Sum('actual_cash'))
            c_other = ClosingOtherSale.objects.filter(
                closing__organization=org, closing__closing_date__range=[compare_start, compare_end],
            ).aggregate(total=Sum('amount'))
            compare_total = float(c_agg['card'] or 0) + float(c_agg['cash'] or 0) + float(c_other['total'] or 0)
            compare_count = compare_closings.count()
            compare_avg = compare_total / max(compare_count, 1)
            avg_daily = total / max(days_count, 1)
            impact_pct = ((avg_daily - compare_avg) / max(compare_avg, 1)) * 100 if compare_avg > 0 else 0

            # Staffing
            timesheets = Timesheet.objects.filter(
                organization=org, date__range=[ly_start, ly_end], check_in__isnull=False,
            )
            staff_count = timesheets.values('user').distinct().count()
            total_shifts = timesheets.count()
            total_hours = sum(t.worked_hours for t in timesheets if t.worked_hours)
            avg_staff_per_day = round(total_shifts / max(ly_duration, 1), 1)

            # Normal staffing
            compare_ts = Timesheet.objects.filter(
                organization=org, date__range=[compare_start, compare_end], check_in__isnull=False,
            )
            compare_staff_avg = round(compare_ts.count() / max((compare_end - compare_start).days + 1, 1), 1)
            compare_hours = sum(t.worked_hours for t in compare_ts if t.worked_hours)

            splh = round(total / max(total_hours, 1), 2) if total_hours > 0 else 0
            normal_splh = round(compare_total / max(compare_hours, 1), 2) if compare_hours > 0 else 0

            return {
                'year': past_holiday.year,
                'start_date': str(ly_start),
                'end_date': str(ly_end),
                'duration': ly_duration,
                'total_sales': round(total, 2),
                'avg_daily': round(avg_daily, 2),
                'days_with_data': days_count,
                'normal_avg': round(compare_avg, 2),
                'impact_pct': round(impact_pct, 1),
                'staff_count': staff_count,
                'total_shifts': total_shifts,
                'total_hours': round(total_hours, 1),
                'avg_staff_per_day': avg_staff_per_day,
                'normal_staff_avg': compare_staff_avg,
                'splh': splh,
                'normal_splh': normal_splh,
            }

        result = []
        for h in target_holidays:
            days_until = max((h.start_date - today).days, 0)
            duration = (h.end_date - h.start_date).days + 1

            item = {
                'id': h.id,
                'name': h.name,
                'name_ko': h.name_ko,
                'category': h.category,
                'start_date': str(h.start_date),
                'end_date': str(h.end_date),
                'impact': h.impact,
                'days_until': days_until,
                'is_ongoing': h.start_date <= today <= h.end_date,
                'duration': duration,
                'history': [],
            }

            # Get past 2 years of data
            for years_back in [1, 2]:
                past_holiday = Holiday.objects.filter(
                    name=h.name, year=h.year - years_back,
                ).first()
                data = _get_holiday_data(past_holiday, org)
                if data:
                    item['history'].append(data)

            result.append(item)

        return Response({'upcoming': result})

    def _compute_dow_avg(self, daily_rows):
        """Compute day-of-week averages from daily data."""
        from collections import defaultdict
        dow_map = defaultdict(list)
        for d in daily_rows:
            dt = date_type.fromisoformat(d['date'])
            dow_map[dt.strftime('%a')].append(d['total'])
        day_order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        return [
            {'day': day, 'avg_sales': round(sum(dow_map.get(day, [])) / max(len(dow_map.get(day, [])), 1), 2)}
            for day in day_order
        ]
