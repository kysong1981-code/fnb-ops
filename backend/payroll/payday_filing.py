"""
NZ PayDay Filing Engine
Generate employment information for IRD filing.
Must be filed within 2 working days of each payday.
"""
import csv
import io
from datetime import timedelta
from decimal import Decimal


def calculate_due_date(payment_date):
    """Calculate filing due date: payment_date + 2 business days.

    Business days exclude weekends and NZ public holidays.
    """
    from .holidays import is_public_holiday

    due = payment_date
    business_days = 0

    while business_days < 2:
        due += timedelta(days=1)
        # Skip weekends
        if due.weekday() >= 5:  # Saturday=5, Sunday=6
            continue
        # Skip public holidays
        if is_public_holiday(due):
            continue
        business_days += 1

    return due


def generate_filing_data(pay_period):
    """Generate IRD employment information data for a pay period.

    Returns a dict containing all required filing information.
    """
    organization = pay_period.organization
    payslips = pay_period.pay_slips.select_related('user__user').all()

    employees_data = []
    for ps in payslips:
        user_profile = ps.user
        user = user_profile.user

        employees_data.append({
            'ird_number': user_profile.tax_file_number or '',
            'first_name': user.first_name,
            'last_name': user.last_name,
            'tax_code': ps.tax_code,
            'pay_period_start': pay_period.start_date.isoformat(),
            'pay_period_end': pay_period.end_date.isoformat(),
            'payment_date': pay_period.payment_date.isoformat(),
            'hours_paid': str(ps.total_hours),
            'gross_earnings': str(ps.gross_salary),
            'paye_deducted': str(ps.paye_tax),
            'student_loan_deducted': str(ps.student_loan_deduction),
            'kiwisaver_employee': str(ps.kiwisaver),
            'kiwisaver_employer': str(ps.kiwisaver_employer),
            'esct': str(ps.esct),
            'employer_acc': str(ps.employer_acc),
        })

    return {
        'employer_ird': organization.ird_number or '',
        'employer_name': organization.name,
        'pay_date': pay_period.payment_date.isoformat(),
        'period_start': pay_period.start_date.isoformat(),
        'period_end': pay_period.end_date.isoformat(),
        'period_type': pay_period.period_type,
        'employee_count': len(employees_data),
        'employees': employees_data,
        'totals': {
            'gross_earnings': str(sum(Decimal(e['gross_earnings']) for e in employees_data)),
            'paye': str(sum(Decimal(e['paye_deducted']) for e in employees_data)),
            'student_loan': str(sum(Decimal(e['student_loan_deducted']) for e in employees_data)),
            'kiwisaver_employee': str(sum(Decimal(e['kiwisaver_employee']) for e in employees_data)),
            'kiwisaver_employer': str(sum(Decimal(e['kiwisaver_employer']) for e in employees_data)),
            'esct': str(sum(Decimal(e['esct']) for e in employees_data)),
        },
    }


def generate_csv_content(pay_period):
    """Generate CSV file content for IRD myIR file upload.

    Format follows IRD Employment Information Return specification.
    """
    filing_data = generate_filing_data(pay_period)
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        'Employer IRD',
        'Employee IRD',
        'Employee Name',
        'Tax Code',
        'Pay Period Start',
        'Pay Period End',
        'Payment Date',
        'Hours Paid',
        'Gross Earnings',
        'PAYE Deducted',
        'Student Loan',
        'KiwiSaver Employee',
        'KiwiSaver Employer',
        'ESCT',
    ])

    employer_ird = filing_data['employer_ird']

    for emp in filing_data['employees']:
        writer.writerow([
            employer_ird,
            emp['ird_number'],
            f"{emp['first_name']} {emp['last_name']}",
            emp['tax_code'],
            emp['pay_period_start'],
            emp['pay_period_end'],
            emp['payment_date'],
            emp['hours_paid'],
            emp['gross_earnings'],
            emp['paye_deducted'],
            emp['student_loan_deducted'],
            emp['kiwisaver_employee'],
            emp['kiwisaver_employer'],
            emp['esct'],
        ])

    return output.getvalue()
