"""Seed sample data for OneOps (Store 3) ONLY - never touches other stores."""
import random
from datetime import date, timedelta, datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Seed sample closing + timesheet data for OneOps (org_id=3) only'

    def add_arguments(self, parser):
        parser.add_argument('--org-id', type=int, default=3, help='Organization ID (default: 3)')

    def handle(self, *args, **options):
        from closing.models import DailyClosing, ClosingOtherSale
        from hr.models import Timesheet
        from users.models import Organization, UserProfile

        org_id = options['org_id']
        org = Organization.objects.filter(id=org_id).first()
        if not org:
            self.stderr.write(f'Organization {org_id} not found')
            return

        self.stdout.write(f'Seeding data for: {org.name} (id={org_id})')

        # Get a user profile for created_by
        profile = UserProfile.objects.filter(organization_id=org_id).first()
        if not profile:
            self.stderr.write(f'No user profile found for org {org_id}')
            return

        # Get staff profiles for timesheets
        staff_profiles = list(UserProfile.objects.filter(organization_id=org_id))

        # Date range: Feb 1 2025 to Mar 14 2026 (to have last year data + current)
        # Last year: Feb 2025 - Mar 2025
        # This year: Feb 2026 - Mar 2026
        periods = [
            # Last year data (for YoY comparison)
            (date(2025, 2, 1), date(2025, 3, 31)),
            # This year previous months
            (date(2025, 12, 1), date(2025, 12, 31)),
            (date(2026, 1, 1), date(2026, 1, 31)),
            (date(2026, 2, 1), date(2026, 2, 28)),
            # This month (up to today-ish)
            (date(2026, 3, 1), date(2026, 3, 14)),
        ]

        created = 0
        ts_created = 0

        for period_start, period_end in periods:
            d = period_start
            while d <= period_end:
                # Skip if already exists
                if DailyClosing.objects.filter(organization_id=org_id, closing_date=d).exists():
                    d += timedelta(days=1)
                    continue

                # Realistic NZ cafe/restaurant sales
                # Weekday: $1,500 - $3,500, Weekend: $2,500 - $5,000
                is_weekend = d.weekday() >= 5
                if is_weekend:
                    base = random.uniform(2500, 5000)
                else:
                    base = random.uniform(1500, 3500)

                # Seasonal variation: Dec-Jan higher (summer in NZ), Jun-Aug lower
                month = d.month
                if month in [12, 1, 2]:
                    base *= random.uniform(1.1, 1.3)
                elif month in [6, 7, 8]:
                    base *= random.uniform(0.75, 0.9)

                # Year-over-year growth ~5-15%
                if d.year == 2026:
                    base *= random.uniform(1.05, 1.15)

                total = round(base, 2)
                # Card: 65-80%, Cash: rest
                card_pct = random.uniform(0.65, 0.80)
                card = round(total * card_pct, 2)
                cash = round(total * (1 - card_pct), 2)

                # Tab count: roughly $30-50 per transaction
                tab_count = max(int(total / random.uniform(30, 50)), 1)

                # Small variance between POS and actual
                variance = random.uniform(-20, 20)

                closing = DailyClosing.objects.create(
                    organization_id=org_id,
                    closing_date=d,
                    created_by=profile,
                    approved_by=profile,
                    pos_card=Decimal(str(card)),
                    pos_cash=Decimal(str(cash)),
                    tab_count=tab_count,
                    actual_card=Decimal(str(round(card + variance * 0.5, 2))),
                    actual_cash=Decimal(str(round(cash + variance * 0.5, 2))),
                    bank_deposit=Decimal(str(round(cash - random.uniform(50, 200), 2))),
                    status='APPROVED',
                )
                created += 1

                # Add some Other Sales (e.g., UberEats, DoorDash)
                if random.random() > 0.3:
                    uber_amount = round(random.uniform(80, 350), 2)
                    ClosingOtherSale.objects.create(
                        closing=closing,
                        name='UberEats',
                        amount=Decimal(str(uber_amount)),
                    )
                if random.random() > 0.5:
                    dd_amount = round(random.uniform(50, 200), 2)
                    ClosingOtherSale.objects.create(
                        closing=closing,
                        name='DoorDash',
                        amount=Decimal(str(dd_amount)),
                    )

                # Create timesheets for staff
                for sp in staff_profiles[:min(len(staff_profiles), 4)]:
                    if Timesheet.objects.filter(user=sp, date=d).exists():
                        continue
                    # Random shift: 6-10 hours
                    hours = random.uniform(5, 10)
                    check_in_hour = random.randint(7, 11)
                    check_in_dt = timezone.make_aware(
                        datetime(d.year, d.month, d.day, check_in_hour, random.randint(0, 30))
                    )
                    check_out_dt = check_in_dt + timedelta(hours=hours)
                    break_mins = random.choice([0, 15, 30])

                    Timesheet.objects.create(
                        organization_id=org_id,
                        user=sp,
                        date=d,
                        check_in=check_in_dt,
                        check_out=check_out_dt,
                        total_break_minutes=break_mins,
                        is_approved=True,
                    )
                    ts_created += 1

                d += timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(
            f'Done! Created {created} closings, {ts_created} timesheets for {org.name}'
        ))
