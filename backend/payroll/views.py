from datetime import timedelta
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from django.utils import timezone
from django.http import HttpResponse

from .models import Salary, PayPeriod, PaySlip, PublicHoliday, LeaveBalance, LeaveRequest, PayDayFiling
from .serializers import (
    SalarySerializer, PayPeriodSerializer,
    PaySlipDetailSerializer, PaySlipListSerializer,
    PublicHolidaySerializer, LeaveBalanceSerializer,
    LeaveRequestSerializer, PayDayFilingSerializer,
)
from .calculations import (
    is_otherwise_working_day, calculate_annual_leave_rate,
)
from .holidays import generate_public_holidays, is_public_holiday
from .payday_filing import generate_filing_data, generate_csv_content, calculate_due_date
from users.permissions import IsManager
from users.filters import OrganizationFilterBackend


class SalaryViewSet(viewsets.ModelViewSet):
    """시급 관리 ViewSet"""
    queryset = Salary.objects.all()
    serializer_class = SalarySerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        return super().get_queryset().select_related('user__user', 'organization')

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.profile.organization)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """활성 시급만 조회"""
        salaries = self.filter_queryset(self.get_queryset()).filter(is_active=True)
        serializer = self.get_serializer(salaries, many=True)
        return Response(serializer.data)


class PayPeriodViewSet(viewsets.ModelViewSet):
    """급여 지급 기간 관리 ViewSet"""
    queryset = PayPeriod.objects.all()
    serializer_class = PayPeriodSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        return super().get_queryset().select_related('organization').prefetch_related('pay_slips').order_by('-start_date')

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.profile.organization)

    @action(detail=True, methods=['post'])
    def generate_payslips(self, request, pk=None):
        """Generate payslips from approved timesheets for this pay period."""
        from hr.models import Timesheet

        pay_period = self.get_object()
        org = pay_period.organization

        if pay_period.status == 'FINALIZED':
            return Response({'error': 'Cannot generate for finalized period.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get approved timesheets in this period
        timesheets = Timesheet.objects.filter(
            organization=org,
            date__gte=pay_period.start_date,
            date__lte=pay_period.end_date,
            is_approved=True,
            check_in__isnull=False,
            check_out__isnull=False,
        ).select_related('user')

        if not timesheets.exists():
            return Response({'error': 'No approved timesheets found for this period.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get public holidays for this period
        holidays_in_period = set()
        for d in PublicHoliday.objects.filter(
            year=pay_period.start_date.year,
            observed_date__gte=pay_period.start_date,
            observed_date__lte=pay_period.end_date,
        ).filter(
            models_Q_national_or_region(org.region)
        ):
            holidays_in_period.add(d.observed_date)

        # If no public holidays in DB, check dynamically
        if not holidays_in_period:
            from .holidays import generate_public_holidays as gen_holidays
            for h in gen_holidays(pay_period.start_date.year, org.region):
                if pay_period.start_date <= h['observed_date'] <= pay_period.end_date:
                    holidays_in_period.add(h['observed_date'])

        # Group timesheets by employee
        from collections import defaultdict
        employee_data = defaultdict(lambda: {
            'regular_hours': Decimal('0'),
            'overtime_hours': Decimal('0'),
            'public_holiday_hours': Decimal('0'),
            'alternative_holidays': 0,
        })

        for ts in timesheets:
            hours = Decimal(str(ts.worked_hours or 0))
            user = ts.user

            is_ph = ts.date in holidays_in_period

            if is_ph:
                # Public holiday work
                employee_data[user.id]['public_holiday_hours'] += hours
                # Check OWD for alternative holiday
                if is_otherwise_working_day(user, ts.date, org):
                    employee_data[user.id]['alternative_holidays'] += 1
            elif ts.is_overtime and ts.overtime_approved:
                employee_data[user.id]['overtime_hours'] += hours
            else:
                employee_data[user.id]['regular_hours'] += hours

        # Create/update payslips
        from users.models import UserProfile
        created_count = 0
        updated_count = 0

        for user_id, data in employee_data.items():
            try:
                user_profile = UserProfile.objects.get(id=user_id)
            except UserProfile.DoesNotExist:
                continue

            # Get active salary
            salary = Salary.objects.filter(user=user_profile, is_active=True).first()
            if not salary:
                continue

            hourly_rate = salary.hourly_rate
            overtime_rate = hourly_rate * salary.overtime_multiplier

            # Get tax code from IR330
            tax_code = 'M'
            try:
                ir330 = user_profile.ir330_declarations.order_by('-created_at').first()
                if ir330:
                    tax_code = ir330.tax_code
            except Exception:
                pass

            # Public holiday hours also count as regular hours (paid at 1x base in regular_hours)
            total_regular = data['regular_hours'] + data['public_holiday_hours']

            payslip, created = PaySlip.objects.update_or_create(
                pay_period=pay_period,
                user=user_profile,
                defaults={
                    'regular_hours': total_regular,
                    'overtime_hours': data['overtime_hours'],
                    'public_holiday_hours': data['public_holiday_hours'],
                    'hourly_rate': hourly_rate,
                    'overtime_rate': overtime_rate,
                    'tax_code': tax_code,
                    'alternative_holidays_earned': data['alternative_holidays'],
                }
            )

            payslip.calculate_salary()
            payslip.save()

            # Accrue alternative holidays
            if data['alternative_holidays'] > 0:
                year = pay_period.start_date.year
                balance, _ = LeaveBalance.objects.get_or_create(
                    user=user_profile,
                    organization=org,
                    leave_type='ALTERNATIVE',
                    year=year,
                    defaults={'balance_hours': 0, 'accrued_hours': 0, 'used_hours': 0}
                )
                # Each alternative holiday = 1 day (8 hours default)
                added_hours = Decimal(str(data['alternative_holidays'])) * 8
                balance.accrued_hours += added_hours
                balance.balance_hours += added_hours
                balance.save()

            if created:
                created_count += 1
            else:
                updated_count += 1

        pay_period.status = 'GENERATED'
        pay_period.save()

        return Response({
            'message': f'{created_count} payslips created, {updated_count} updated.',
            'created': created_count,
            'updated': updated_count,
        })

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        """Finalize pay period: lock all payslips + create PayDay Filing."""
        pay_period = self.get_object()

        if pay_period.status == 'FINALIZED':
            return Response({'error': 'Already finalized.'}, status=status.HTTP_400_BAD_REQUEST)

        # Lock all payslips
        pay_period.pay_slips.update(is_locked=True)

        # Update status
        pay_period.status = 'FINALIZED'
        pay_period.is_finalized = True
        pay_period.save()

        # Create PayDay Filing record
        due_date = calculate_due_date(pay_period.payment_date)
        PayDayFiling.objects.get_or_create(
            pay_period=pay_period,
            organization=pay_period.organization,
            defaults={
                'status': 'PENDING',
                'due_date': due_date,
            }
        )

        return Response({'message': 'Pay period finalized. PayDay Filing created.'})


def models_Q_national_or_region(region):
    """Build Q filter for national holidays + regional holidays."""
    from django.db.models import Q
    q = Q(is_national=True)
    if region:
        q |= Q(region=region)
    return q


class PaySlipViewSet(viewsets.ModelViewSet):
    """급여명세서 관리 ViewSet"""
    queryset = PaySlip.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [OrganizationFilterBackend]

    def get_serializer_class(self):
        if self.action in ('retrieve', 'calculate'):
            return PaySlipDetailSerializer
        return PaySlipListSerializer

    def get_permissions(self):
        employee_actions = ['retrieve', 'my_payslips', 'summary']
        if self.action in employee_actions:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsManager()]

    def get_queryset(self):
        user_profile = self.request.user.profile
        queryset = super().get_queryset().select_related('user__user', 'pay_period')

        if user_profile.role == 'EMPLOYEE':
            queryset = queryset.filter(user=user_profile)

        # Filter by pay_period if provided
        pay_period_id = self.request.query_params.get('pay_period')
        if pay_period_id:
            queryset = queryset.filter(pay_period_id=pay_period_id)

        return queryset.order_by('-pay_period__start_date')

    @action(detail=True, methods=['post'])
    def calculate(self, request, pk=None):
        """Recalculate a payslip."""
        payslip = self.get_object()
        if payslip.is_locked:
            return Response({'error': 'Cannot modify locked payslip.'}, status=status.HTTP_400_BAD_REQUEST)
        payslip.calculate_salary()
        payslip.save()
        return Response(PaySlipDetailSerializer(payslip).data)

    @action(detail=False, methods=['get'])
    def my_payslips(self, request):
        """Employee's own payslips."""
        payslips = PaySlip.objects.filter(user=request.user.profile).order_by('-pay_period__start_date')
        serializer = PaySlipListSerializer(payslips, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Payslip summary for display."""
        payslip = self.get_object()
        return Response({
            'employee': payslip.user.user.get_full_name(),
            'period': f"{payslip.pay_period.start_date} to {payslip.pay_period.end_date}",
            'hours': {
                'regular': float(payslip.regular_hours),
                'overtime': float(payslip.overtime_hours),
                'public_holiday': float(payslip.public_holiday_hours),
                'total': float(payslip.total_hours),
            },
            'earnings': {
                'regular_pay': float(payslip.regular_pay),
                'overtime_pay': float(payslip.overtime_pay),
                'public_holiday_pay': float(payslip.public_holiday_pay),
                'holiday_pay': float(payslip.holiday_pay),
                'gross_salary': float(payslip.gross_salary),
            },
            'deductions': {
                'paye_tax': float(payslip.paye_tax),
                'kiwisaver': float(payslip.kiwisaver),
                'student_loan': float(payslip.student_loan_deduction),
                'other': float(payslip.other_deductions),
                'total': float(payslip.total_deductions),
            },
            'net_salary': float(payslip.net_salary),
            'employer_contributions': {
                'kiwisaver': float(payslip.kiwisaver_employer),
                'esct': float(payslip.esct),
                'acc_levy': float(payslip.employer_acc),
            },
            'tax_code': payslip.tax_code,
            'alternative_holidays_earned': payslip.alternative_holidays_earned,
        })

    @action(detail=False, methods=['get'])
    def period_summary(self, request):
        """Period summary with aggregated totals."""
        pay_period_id = request.query_params.get('pay_period_id')
        if not pay_period_id:
            return Response({'error': 'pay_period_id required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pay_period = PayPeriod.objects.get(id=pay_period_id)
        except PayPeriod.DoesNotExist:
            return Response({'error': 'Pay period not found.'}, status=status.HTTP_400_BAD_REQUEST)

        payslips = self.filter_queryset(self.get_queryset()).filter(pay_period=pay_period)

        return Response({
            'period': f"{pay_period.start_date} to {pay_period.end_date}",
            'payment_date': pay_period.payment_date,
            'payslip_count': payslips.count(),
            'totals': {
                'hours': float(payslips.aggregate(Sum('total_hours'))['total_hours__sum'] or 0),
                'gross_salary': float(payslips.aggregate(Sum('gross_salary'))['gross_salary__sum'] or 0),
                'paye_tax': float(payslips.aggregate(Sum('paye_tax'))['paye_tax__sum'] or 0),
                'kiwisaver': float(payslips.aggregate(Sum('kiwisaver'))['kiwisaver__sum'] or 0),
                'student_loan': float(payslips.aggregate(Sum('student_loan_deduction'))['student_loan_deduction__sum'] or 0),
                'holiday_pay': float(payslips.aggregate(Sum('holiday_pay'))['holiday_pay__sum'] or 0),
                'total_deductions': float(payslips.aggregate(Sum('total_deductions'))['total_deductions__sum'] or 0),
                'net_salary': float(payslips.aggregate(Sum('net_salary'))['net_salary__sum'] or 0),
            }
        })


class PublicHolidayViewSet(viewsets.ModelViewSet):
    """NZ Public Holiday ViewSet"""
    queryset = PublicHoliday.objects.all()
    serializer_class = PublicHolidaySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        queryset = PublicHoliday.objects.all()
        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(year=int(year))

        # Include national + org region
        org = self.request.user.profile.organization
        from django.db.models import Q
        q = Q(is_national=True)
        if org and org.region:
            q |= Q(region=org.region)
        return queryset.filter(q).order_by('observed_date')

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate public holidays for a year."""
        year = request.data.get('year')
        if not year:
            return Response({'error': 'year required.'}, status=status.HTTP_400_BAD_REQUEST)

        year = int(year)
        org = request.user.profile.organization
        region = org.region if org else None

        holidays_data = generate_public_holidays(year, region)

        created_count = 0
        for h in holidays_data:
            _, created = PublicHoliday.objects.update_or_create(
                date=h['date'],
                region=h['region'],
                year=h['year'],
                defaults={
                    'observed_date': h['observed_date'],
                    'name': h['name'],
                    'is_national': h['is_national'],
                }
            )
            if created:
                created_count += 1

        return Response({
            'message': f'{created_count} holidays created for {year}.',
            'total': len(holidays_data),
        })


class LeaveBalanceViewSet(viewsets.ModelViewSet):
    """Leave Balance ViewSet"""
    queryset = LeaveBalance.objects.all()
    serializer_class = LeaveBalanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrganizationFilterBackend]

    def get_permissions(self):
        if self.action in ('list', 'my_balances'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsManager()]

    def get_queryset(self):
        queryset = super().get_queryset().select_related('user__user', 'organization')
        user_profile = self.request.user.profile

        if user_profile.role == 'EMPLOYEE':
            queryset = queryset.filter(user=user_profile)

        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(year=int(year))

        return queryset

    @action(detail=False, methods=['get'])
    def my_balances(self, request):
        """Employee's own leave balances."""
        year = request.query_params.get('year', timezone.now().year)
        balances = LeaveBalance.objects.filter(
            user=request.user.profile,
            year=int(year),
        )
        serializer = LeaveBalanceSerializer(balances, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def initialize(self, request):
        """Initialize leave balances for an employee (on hire)."""
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required.'}, status=status.HTTP_400_BAD_REQUEST)

        from users.models import UserProfile
        try:
            user_profile = UserProfile.objects.get(id=user_id)
        except UserProfile.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_400_BAD_REQUEST)

        org = request.user.profile.organization
        year = timezone.now().year
        start_date = user_profile.date_of_joining
        entitlement_date = start_date + timedelta(days=183)  # ~6 months

        leave_types_config = {
            'ANNUAL': {'accrued': 0, 'entitlement_after_months': 12},  # 4 weeks after 12 months
            'SICK': {'accrued': 80, 'entitlement_after_months': 6},    # 10 days (80h) after 6 months
            'BEREAVEMENT': {'accrued': 24, 'entitlement_after_months': 6},  # 3 days (24h)
            'FAMILY_VIOLENCE': {'accrued': 80, 'entitlement_after_months': 6},  # 10 days (80h)
            'ALTERNATIVE': {'accrued': 0, 'entitlement_after_months': 0},  # earned from PH work
        }

        created = 0
        for leave_type, config in leave_types_config.items():
            _, was_created = LeaveBalance.objects.get_or_create(
                user=user_profile,
                organization=org,
                leave_type=leave_type,
                year=year,
                defaults={
                    'balance_hours': Decimal(str(config['accrued'])),
                    'accrued_hours': Decimal(str(config['accrued'])),
                    'used_hours': Decimal('0'),
                    'entitlement_date': start_date + timedelta(days=config['entitlement_after_months'] * 30),
                }
            )
            if was_created:
                created += 1

        return Response({'message': f'{created} leave balances initialized.'})


class LeaveRequestViewSet(viewsets.ModelViewSet):
    """Leave Request ViewSet with approval workflow"""
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrganizationFilterBackend]

    def get_permissions(self):
        if self.action in ('create', 'my_requests', 'cancel'):
            return [IsAuthenticated()]
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsManager()]

    def get_queryset(self):
        queryset = super().get_queryset().select_related('user__user', 'approved_by__user', 'organization')
        user_profile = self.request.user.profile

        if user_profile.role == 'EMPLOYEE':
            queryset = queryset.filter(user=user_profile)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        user_profile = self.request.user.profile
        serializer.save(
            user=user_profile,
            organization=user_profile.organization,
        )

    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Employee's own leave requests."""
        requests = LeaveRequest.objects.filter(user=request.user.profile).order_by('-created_at')
        serializer = LeaveRequestSerializer(requests, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Manager approves a leave request."""
        leave_request = self.get_object()

        if leave_request.status != 'PENDING':
            return Response({'error': 'Can only approve pending requests.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check balance
        year = leave_request.start_date.year
        try:
            balance = LeaveBalance.objects.get(
                user=leave_request.user,
                leave_type=leave_request.leave_type,
                year=year,
            )
        except LeaveBalance.DoesNotExist:
            return Response({'error': 'No leave balance found for this type.'}, status=status.HTTP_400_BAD_REQUEST)

        if balance.balance_hours < leave_request.total_hours:
            return Response({
                'error': f'Insufficient balance. Available: {balance.balance_hours}h, Requested: {leave_request.total_hours}h'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Calculate pay amount (max of OWP, AWE for annual leave)
        if leave_request.leave_type == 'ANNUAL':
            weekly_rate = calculate_annual_leave_rate(leave_request.user, leave_request.start_date)
            daily_rate = weekly_rate / 5  # Assume 5-day week
            days = leave_request.total_hours / 8
            leave_request.paid_amount = (daily_rate * days).quantize(Decimal('0.01'))

        # Deduct balance
        balance.used_hours += leave_request.total_hours
        balance.balance_hours -= leave_request.total_hours
        balance.save()

        # Approve
        leave_request.status = 'APPROVED'
        leave_request.approved_by = request.user.profile
        leave_request.approved_at = timezone.now()
        leave_request.save()

        return Response({'message': 'Leave request approved.'})

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Manager declines a leave request."""
        leave_request = self.get_object()

        if leave_request.status != 'PENDING':
            return Response({'error': 'Can only decline pending requests.'}, status=status.HTTP_400_BAD_REQUEST)

        leave_request.status = 'DECLINED'
        leave_request.decline_reason = request.data.get('reason', '')
        leave_request.save()

        return Response({'message': 'Leave request declined.'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Employee or manager cancels a leave request."""
        leave_request = self.get_object()

        # Only pending or approved can be cancelled
        if leave_request.status not in ('PENDING', 'APPROVED'):
            return Response({'error': 'Cannot cancel this request.'}, status=status.HTTP_400_BAD_REQUEST)

        # If was approved, restore balance
        if leave_request.status == 'APPROVED':
            year = leave_request.start_date.year
            try:
                balance = LeaveBalance.objects.get(
                    user=leave_request.user,
                    leave_type=leave_request.leave_type,
                    year=year,
                )
                balance.used_hours -= leave_request.total_hours
                balance.balance_hours += leave_request.total_hours
                balance.save()
            except LeaveBalance.DoesNotExist:
                pass

        leave_request.status = 'CANCELLED'
        leave_request.save()

        return Response({'message': 'Leave request cancelled.'})


class PayDayFilingViewSet(viewsets.ModelViewSet):
    """PayDay Filing ViewSet — IRD filing management"""
    queryset = PayDayFiling.objects.all()
    serializer_class = PayDayFilingSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]

    def get_queryset(self):
        return super().get_queryset().select_related('pay_period', 'organization').order_by('-due_date')

    @action(detail=True, methods=['post'])
    def generate(self, request, pk=None):
        """Generate IRD filing data."""
        filing = self.get_object()

        if filing.status == 'FILED':
            return Response({'error': 'Already filed.'}, status=status.HTTP_400_BAD_REQUEST)

        filing.file_data = generate_filing_data(filing.pay_period)
        filing.status = 'GENERATED'
        filing.generated_at = timezone.now()
        filing.save()

        return Response({
            'message': 'Filing data generated.',
            'data': filing.file_data,
        })

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download filing as CSV for IRD myIR upload."""
        filing = self.get_object()

        csv_content = generate_csv_content(filing.pay_period)

        response = HttpResponse(csv_content, content_type='text/csv')
        filename = f"payday_filing_{filing.pay_period.start_date}_{filing.pay_period.end_date}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['post'])
    def mark_filed(self, request, pk=None):
        """Mark filing as submitted to IRD."""
        filing = self.get_object()
        filing.status = 'FILED'
        filing.filed_at = timezone.now()
        filing.notes = request.data.get('notes', '')
        filing.save()
        return Response({'message': 'Filing marked as submitted to IRD.'})
