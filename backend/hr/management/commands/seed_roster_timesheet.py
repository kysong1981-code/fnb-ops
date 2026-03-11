from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, time, datetime
from users.models import UserProfile
from hr.models import Roster, Timesheet
import random


class Command(BaseCommand):
    help = 'Seed sample roster and timesheet data for this week'

    def handle(self, *args, **options):
        # Get all active employees with an organization
        profiles = UserProfile.objects.filter(
            employment_status='ACTIVE',
            organization__isnull=False,
        ).select_related('user', 'organization')

        if not profiles.exists():
            self.stdout.write(self.style.ERROR(
                'No active employees found. Run create_sample_data first.'
            ))
            return

        # Determine this week's Monday
        today = timezone.now().date()
        monday = today - timedelta(days=today.weekday())  # Monday of this week

        shift_templates = [
            {'label': 'Morning', 'start': time(6, 0), 'end': time(14, 0)},
            {'label': 'Afternoon', 'start': time(14, 0), 'end': time(22, 0)},
        ]

        roster_count = 0
        timesheet_count = 0

        for profile in profiles:
            org = profile.organization

            # ---- ROSTER: This week + next week ----
            for week_offset in [0, 1]:
                week_monday = monday + timedelta(weeks=week_offset)

                # Assign 5 shifts per employee per week (random days off)
                all_days = list(range(7))  # Mon=0 .. Sun=6
                days_off = sorted(random.sample(all_days, 2))  # 2 days off
                work_days = [d for d in all_days if d not in days_off]

                for day_idx in work_days:
                    shift_date = week_monday + timedelta(days=day_idx)
                    shift = random.choice(shift_templates)

                    roster, created = Roster.objects.get_or_create(
                        user=profile,
                        date=shift_date,
                        defaults={
                            'organization': org,
                            'shift_start': shift['start'],
                            'shift_end': shift['end'],
                            'is_confirmed': week_offset == 0,  # This week confirmed, next week draft
                        }
                    )
                    if created:
                        roster_count += 1

            # ---- TIMESHEET: Past days this week (already worked) ----
            for day_offset in range(0, today.weekday()):
                ts_date = monday + timedelta(days=day_offset)

                # Check if this employee had a roster for that day
                roster = Roster.objects.filter(user=profile, date=ts_date).first()
                if not roster:
                    continue

                # Create a realistic timesheet
                scheduled_start = roster.shift_start
                # Random variance: -10 to +10 minutes from scheduled start
                variance_min = random.randint(-10, 10)
                actual_start_dt = datetime.combine(ts_date, scheduled_start) + timedelta(minutes=variance_min)
                check_in = timezone.make_aware(actual_start_dt)

                # Work for scheduled hours + random 0-30 min
                scheduled_hours = 8
                extra_min = random.randint(-15, 30)
                check_out = check_in + timedelta(hours=scheduled_hours, minutes=extra_min)

                # Break: 30 min break roughly in the middle
                break_minutes = 30
                break_start = check_in + timedelta(hours=random.randint(3, 5))
                break_end = break_start + timedelta(minutes=break_minutes)

                ts, created = Timesheet.objects.get_or_create(
                    user=profile,
                    date=ts_date,
                    defaults={
                        'organization': org,
                        'check_in': check_in,
                        'check_out': check_out,
                        'break_start': break_start,
                        'break_end': break_end,
                        'total_break_minutes': break_minutes,
                        'is_approved': random.choice([True, True, False]),  # 2/3 approved
                        'notes': '',
                    }
                )
                if created:
                    timesheet_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Created {roster_count} roster entries and {timesheet_count} timesheet entries'
        ))

        # Summary
        self.stdout.write('')
        self.stdout.write('Roster Summary:')
        self.stdout.write(f'  This week ({monday} ~ {monday + timedelta(days=6)}): '
                          f'{Roster.objects.filter(date__gte=monday, date__lte=monday + timedelta(days=6)).count()} entries')
        next_monday = monday + timedelta(weeks=1)
        self.stdout.write(f'  Next week ({next_monday} ~ {next_monday + timedelta(days=6)}): '
                          f'{Roster.objects.filter(date__gte=next_monday, date__lte=next_monday + timedelta(days=6)).count()} entries')
        self.stdout.write(f'  Timesheets: {Timesheet.objects.filter(date__gte=monday).count()} entries')
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Done!'))
