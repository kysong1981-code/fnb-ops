"""
NZ Payroll Calculation Engine
- PAYE (2025-2026 tax brackets)
- ESCT (Employer Superannuation Contribution Tax)
- OWP (Ordinary Weekly Pay)
- AWE (Average Weekly Earnings)
- RDP (Relevant Daily Pay)
- ADP (Average Daily Pay)
- OWD (Otherwise Working Day)
"""
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta


def calculate_annual_paye(annual_income):
    """Calculate NZ PAYE income tax using 2025-2026 tax brackets.

    Brackets:
        $0 – $15,600      → 10.5%
        $15,601 – $53,500  → 17.5%
        $53,501 – $78,100  → 30%
        $78,101 – $180,000 → 33%
        $180,001+          → 39%
    """
    annual_income = Decimal(str(annual_income))
    if annual_income <= 0:
        return Decimal('0')

    brackets = [
        (Decimal('15600'), Decimal('0.105')),
        (Decimal('53500'), Decimal('0.175')),
        (Decimal('78100'), Decimal('0.30')),
        (Decimal('180000'), Decimal('0.33')),
        (None, Decimal('0.39')),
    ]

    tax = Decimal('0')
    prev_limit = Decimal('0')

    for limit, rate in brackets:
        if limit is None:
            # Top bracket — no upper limit
            tax += (annual_income - prev_limit) * rate
            break
        if annual_income <= limit:
            tax += (annual_income - prev_limit) * rate
            break
        tax += (limit - prev_limit) * rate
        prev_limit = limit

    return tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_esct(annual_earnings, employer_contribution):
    """Calculate ESCT on employer KiwiSaver contribution.
    From 1 April 2025 thresholds:
        $0 – $18,720       → 10.5%
        $18,721 – $64,200   → 17.5%
        $64,201 – $93,720   → 30%
        $93,721 – $216,000  → 33%
        $216,001+           → 39%

    Note: ESCT uses a single rate (not tiered) based on total earnings.
    """
    annual_earnings = Decimal(str(annual_earnings))
    employer_contribution = Decimal(str(employer_contribution))

    if annual_earnings <= Decimal('18720'):
        rate = Decimal('0.105')
    elif annual_earnings <= Decimal('64200'):
        rate = Decimal('0.175')
    elif annual_earnings <= Decimal('93720'):
        rate = Decimal('0.30')
    elif annual_earnings <= Decimal('216000'):
        rate = Decimal('0.33')
    else:
        rate = Decimal('0.39')

    return (employer_contribution * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_owp(user, as_of_date):
    """Ordinary Weekly Pay: gross earnings over last 4 weeks ÷ 4.

    Per Holidays Act 2003 s8: OWP is what the employee would normally earn per week.
    If it cannot be determined, use the 4-week lookback formula.
    """
    from .models import PaySlip
    four_weeks_ago = as_of_date - timedelta(weeks=4)

    payslips = PaySlip.objects.filter(
        user=user,
        pay_period__end_date__gte=four_weeks_ago,
        pay_period__end_date__lte=as_of_date,
    ).order_by('-pay_period__start_date')

    if not payslips.exists():
        return Decimal('0')

    total_gross = sum(ps.gross_salary for ps in payslips)

    # Normalize to weekly based on period types
    total_weeks = Decimal('0')
    for ps in payslips:
        if ps.pay_period.period_type == 'WEEKLY':
            total_weeks += 1
        elif ps.pay_period.period_type == 'FORTNIGHTLY':
            total_weeks += 2
        elif ps.pay_period.period_type == 'MONTHLY':
            total_weeks += Decimal('4.33')

    if total_weeks == 0:
        return Decimal('0')

    return (total_gross / total_weeks).quantize(Decimal('0.01'))


def calculate_awe(user, as_of_date):
    """Average Weekly Earnings: gross earnings over last 52 weeks ÷ 52.

    Per Holidays Act 2003 s14: AWE = total gross earnings in the 12 months
    ending at the end of the last pay period before the holiday ÷ 52.
    If employed < 12 months, divide by weeks employed.
    """
    from .models import PaySlip
    fifty_two_weeks_ago = as_of_date - timedelta(weeks=52)

    payslips = PaySlip.objects.filter(
        user=user,
        pay_period__end_date__gte=fifty_two_weeks_ago,
        pay_period__end_date__lte=as_of_date,
    )

    if not payslips.exists():
        return Decimal('0')

    total_gross = sum(ps.gross_salary for ps in payslips)

    # Calculate actual weeks of employment in this period
    earliest = min(ps.pay_period.start_date for ps in payslips)
    days_employed = (as_of_date - earliest).days
    weeks_employed = max(Decimal(str(days_employed)) / 7, Decimal('1'))

    # Use 52 or actual weeks, whichever is smaller
    divisor = min(weeks_employed, Decimal('52'))

    return (total_gross / divisor).quantize(Decimal('0.01'))


def calculate_annual_leave_rate(user, as_of_date):
    """Annual leave pay rate = max(OWP, AWE) per NZ Holidays Act s21."""
    owp = calculate_owp(user, as_of_date)
    awe = calculate_awe(user, as_of_date)
    return max(owp, awe)


def calculate_rdp(user, date):
    """Relevant Daily Pay: what the employee would have earned on that day.

    Per Holidays Act 2003 s9: RDP includes wages for the time worked,
    plus relevant additional components (allowances, commissions, etc.).

    Simplified: hourly_rate × normal daily hours for this employee.
    """
    from hr.models import Timesheet

    # Look at the employee's typical daily hours from recent timesheets
    recent_timesheets = Timesheet.objects.filter(
        user=user,
        date__gte=date - timedelta(weeks=4),
        date__lt=date,
        check_in__isnull=False,
        check_out__isnull=False,
    ).exclude(is_approved=False)

    if not recent_timesheets.exists():
        # Fallback: use ADP
        return calculate_adp(user, date)

    # Average daily hours from recent timesheets on same weekday
    same_weekday = [ts for ts in recent_timesheets if ts.date.weekday() == date.weekday()]
    if same_weekday:
        avg_hours = sum(Decimal(str(ts.worked_hours)) for ts in same_weekday) / len(same_weekday)
    else:
        avg_hours = sum(Decimal(str(ts.worked_hours)) for ts in recent_timesheets) / recent_timesheets.count()

    # Get current hourly rate
    from .models import Salary
    salary = Salary.objects.filter(user=user, is_active=True).first()
    if not salary:
        return Decimal('0')

    return (avg_hours * salary.hourly_rate).quantize(Decimal('0.01'))


def calculate_adp(user, as_of_date):
    """Average Daily Pay: gross earnings over 52 weeks ÷ number of days worked.

    Per Holidays Act 2003 s9A: Used when RDP cannot be determined
    or when daily pay varies within the pay period.
    """
    from hr.models import Timesheet
    fifty_two_weeks_ago = as_of_date - timedelta(weeks=52)

    # Total gross earnings
    from .models import PaySlip
    payslips = PaySlip.objects.filter(
        user=user,
        pay_period__end_date__gte=fifty_two_weeks_ago,
        pay_period__end_date__lte=as_of_date,
    )
    total_gross = sum(ps.gross_salary for ps in payslips) if payslips.exists() else Decimal('0')

    # Count days worked (or on paid leave)
    days_worked = Timesheet.objects.filter(
        user=user,
        date__gte=fifty_two_weeks_ago,
        date__lte=as_of_date,
        check_in__isnull=False,
        check_out__isnull=False,
    ).count()

    if days_worked == 0:
        return Decimal('0')

    return (total_gross / Decimal(str(days_worked))).quantize(Decimal('0.01'))


def is_otherwise_working_day(user, date, organization):
    """Determine if a date is an 'otherwise working day' for the employee.

    Uses the organization's otherwise_working_weeks and otherwise_working_threshold.
    Default: 8 weeks lookback, 7 occurrences threshold.

    Checks if the employee has worked on the same weekday at least
    `threshold` times in the last `weeks` weeks.
    """
    from hr.models import Timesheet

    weeks = organization.otherwise_working_weeks or 8
    threshold = organization.otherwise_working_threshold or 7

    lookback_start = date - timedelta(weeks=weeks)
    target_weekday = date.weekday()  # 0=Monday, 6=Sunday

    # Count how many times the employee worked on this weekday
    # Django week_day: 1=Sunday, 2=Monday, ... 7=Saturday
    # Python weekday(): 0=Monday, ... 5=Saturday, 6=Sunday
    django_weekday = (target_weekday + 2) % 7 or 7

    worked_count = Timesheet.objects.filter(
        user=user,
        date__gte=lookback_start,
        date__lt=date,
        date__week_day=django_weekday,
        check_in__isnull=False,
        check_out__isnull=False,
    ).count()

    return worked_count >= threshold
