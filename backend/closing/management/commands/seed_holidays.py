"""Seed holiday calendar: NZ Public Holidays, NZ School Holidays, Chinese holidays."""
from datetime import date
from django.core.management.base import BaseCommand


HOLIDAYS = [
    # ═══════════ 2024 ═══════════
    # NZ Public Holidays 2024
    ('New Year', '새해', 'NZ_PUBLIC', '2024-01-01', '2024-01-02', 'MEDIUM'),
    ('Waitangi Day', '와이탕이 데이', 'NZ_PUBLIC', '2024-02-06', '2024-02-06', 'MEDIUM'),
    ('Easter Holiday', '이스터 홀리데이', 'NZ_PUBLIC', '2024-03-29', '2024-04-01', 'HIGH'),
    ('ANZAC Day', '안작 데이', 'NZ_PUBLIC', '2024-04-25', '2024-04-25', 'MEDIUM'),
    ("King's Birthday", '국왕 생일', 'NZ_PUBLIC', '2024-06-03', '2024-06-03', 'MEDIUM'),
    ('Matariki', '마타리키', 'NZ_PUBLIC', '2024-06-28', '2024-06-28', 'MEDIUM'),
    ('Labour Day', '노동절', 'NZ_PUBLIC', '2024-10-28', '2024-10-28', 'MEDIUM'),
    ('Christmas Day', '크리스마스', 'NZ_PUBLIC', '2024-12-25', '2024-12-25', 'HIGH'),
    ('Boxing Day', '박싱 데이', 'NZ_PUBLIC', '2024-12-26', '2024-12-26', 'HIGH'),
    # Chinese Holidays 2024
    ('Chinese New Year', '춘절 (중국 설날)', 'CN_MAJOR', '2024-02-10', '2024-02-24', 'HIGH'),
    ('Mid-Autumn Festival', '중추절 (중국)', 'CN_FESTIVAL', '2024-09-15', '2024-09-17', 'MEDIUM'),
    ('Chinese National Day (Golden Week)', '국경절 (중국 골든위크)', 'CN_MAJOR', '2024-10-01', '2024-10-07', 'HIGH'),
    # NZ School Holidays 2024
    ('Term 1 Break', '1학기 방학', 'NZ_SCHOOL', '2024-04-13', '2024-04-28', 'MEDIUM'),
    ('Term 2 Break', '2학기 방학', 'NZ_SCHOOL', '2024-07-06', '2024-07-21', 'MEDIUM'),
    ('Term 3 Break', '3학기 방학', 'NZ_SCHOOL', '2024-09-28', '2024-10-13', 'MEDIUM'),
    ('Summer Break', '여름 방학', 'NZ_SCHOOL', '2024-12-19', '2025-02-02', 'HIGH'),

    # ═══════════ 2025 ═══════════
    # NZ Public Holidays 2025
    ('New Year', '새해', 'NZ_PUBLIC', '2025-01-01', '2025-01-02', 'MEDIUM'),
    ('Waitangi Day', '와이탕이 데이', 'NZ_PUBLIC', '2025-02-06', '2025-02-06', 'MEDIUM'),
    ('Easter Holiday', '이스터 홀리데이', 'NZ_PUBLIC', '2025-04-18', '2025-04-21', 'HIGH'),
    ('ANZAC Day', '안작 데이', 'NZ_PUBLIC', '2025-04-25', '2025-04-25', 'MEDIUM'),
    ("King's Birthday", '국왕 생일', 'NZ_PUBLIC', '2025-06-02', '2025-06-02', 'MEDIUM'),
    ('Matariki', '마타리키', 'NZ_PUBLIC', '2025-06-20', '2025-06-20', 'MEDIUM'),
    ('Labour Day', '노동절', 'NZ_PUBLIC', '2025-10-27', '2025-10-27', 'MEDIUM'),
    ('Christmas Day', '크리스마스', 'NZ_PUBLIC', '2025-12-25', '2025-12-25', 'HIGH'),
    ('Boxing Day', '박싱 데이', 'NZ_PUBLIC', '2025-12-26', '2025-12-26', 'HIGH'),
    # Chinese Holidays 2025
    ('Chinese New Year', '춘절 (중국 설날)', 'CN_MAJOR', '2025-01-29', '2025-02-12', 'HIGH'),
    ('Mid-Autumn Festival', '중추절 (중국)', 'CN_FESTIVAL', '2025-10-06', '2025-10-08', 'MEDIUM'),
    ('Chinese National Day (Golden Week)', '국경절 (중국 골든위크)', 'CN_MAJOR', '2025-10-01', '2025-10-07', 'HIGH'),
    # NZ School Holidays 2025
    ('Term 1 Break', '1학기 방학', 'NZ_SCHOOL', '2025-04-12', '2025-04-27', 'MEDIUM'),
    ('Term 2 Break', '2학기 방학', 'NZ_SCHOOL', '2025-06-28', '2025-07-13', 'MEDIUM'),
    ('Term 3 Break', '3학기 방학', 'NZ_SCHOOL', '2025-09-20', '2025-10-05', 'MEDIUM'),
    ('Summer Break', '여름 방학', 'NZ_SCHOOL', '2025-12-18', '2026-02-01', 'HIGH'),

    # ═══════════ 2026 ═══════════
    # NZ Public Holidays 2026
    ('New Year', '새해', 'NZ_PUBLIC', '2026-01-01', '2026-01-02', 'MEDIUM'),
    ('Waitangi Day', '와이탕이 데이', 'NZ_PUBLIC', '2026-02-06', '2026-02-06', 'MEDIUM'),
    ('Easter Holiday', '이스터 홀리데이', 'NZ_PUBLIC', '2026-04-03', '2026-04-06', 'HIGH'),
    ('ANZAC Day', '안작 데이', 'NZ_PUBLIC', '2026-04-27', '2026-04-27', 'MEDIUM'),
    ("King's Birthday", '국왕 생일', 'NZ_PUBLIC', '2026-06-01', '2026-06-01', 'MEDIUM'),
    ('Matariki', '마타리키', 'NZ_PUBLIC', '2026-07-10', '2026-07-10', 'MEDIUM'),
    ('Labour Day', '노동절', 'NZ_PUBLIC', '2026-10-26', '2026-10-26', 'MEDIUM'),
    ('Christmas Day', '크리스마스', 'NZ_PUBLIC', '2026-12-25', '2026-12-25', 'HIGH'),
    ('Boxing Day', '박싱 데이', 'NZ_PUBLIC', '2026-12-26', '2026-12-26', 'HIGH'),
    # Chinese Holidays 2026
    ('Chinese New Year', '춘절 (중국 설날)', 'CN_MAJOR', '2026-02-17', '2026-03-03', 'HIGH'),
    ('Mid-Autumn Festival', '중추절 (중국)', 'CN_FESTIVAL', '2026-09-25', '2026-09-27', 'MEDIUM'),
    ('Chinese National Day (Golden Week)', '국경절 (중국 골든위크)', 'CN_MAJOR', '2026-10-01', '2026-10-07', 'HIGH'),
    # NZ School Holidays 2026
    ('Term 1 Break', '1학기 방학', 'NZ_SCHOOL', '2026-04-03', '2026-04-19', 'MEDIUM'),
    ('Term 2 Break', '2학기 방학', 'NZ_SCHOOL', '2026-07-04', '2026-07-19', 'MEDIUM'),
    ('Term 3 Break', '3학기 방학', 'NZ_SCHOOL', '2026-09-26', '2026-10-11', 'MEDIUM'),
    ('Summer Break', '여름 방학', 'NZ_SCHOOL', '2026-12-17', '2027-02-01', 'HIGH'),

    # ═══════════ 2027 ═══════════
    # NZ Public Holidays 2027
    ('New Year', '새해', 'NZ_PUBLIC', '2027-01-01', '2027-01-04', 'MEDIUM'),
    ('Waitangi Day', '와이탕이 데이', 'NZ_PUBLIC', '2027-02-08', '2027-02-08', 'MEDIUM'),
    ('Easter Holiday', '이스터 홀리데이', 'NZ_PUBLIC', '2027-03-26', '2027-03-29', 'HIGH'),
    ('ANZAC Day', '안작 데이', 'NZ_PUBLIC', '2027-04-26', '2027-04-26', 'MEDIUM'),
    ("King's Birthday", '국왕 생일', 'NZ_PUBLIC', '2027-06-07', '2027-06-07', 'MEDIUM'),
    ('Matariki', '마타리키', 'NZ_PUBLIC', '2027-06-25', '2027-06-25', 'MEDIUM'),
    ('Labour Day', '노동절', 'NZ_PUBLIC', '2027-10-25', '2027-10-25', 'MEDIUM'),
    ('Christmas Day', '크리스마스', 'NZ_PUBLIC', '2027-12-27', '2027-12-27', 'HIGH'),
    ('Boxing Day', '박싱 데이', 'NZ_PUBLIC', '2027-12-28', '2027-12-28', 'HIGH'),
    # Chinese Holidays 2027
    ('Chinese New Year', '춘절 (중국 설날)', 'CN_MAJOR', '2027-02-06', '2027-02-20', 'HIGH'),
    ('Mid-Autumn Festival', '중추절 (중국)', 'CN_FESTIVAL', '2027-09-15', '2027-09-17', 'MEDIUM'),
    ('Chinese National Day (Golden Week)', '국경절 (중국 골든위크)', 'CN_MAJOR', '2027-10-01', '2027-10-07', 'HIGH'),

    # ═══════════ Year-End / Year-Start Seasons ═══════════
    # 2024-2025
    ('Year-End Season', '연말 시즌', 'OTHER', '2024-12-25', '2024-12-31', 'HIGH'),
    ('New Year Season', '연초 시즌', 'OTHER', '2025-01-01', '2025-01-07', 'HIGH'),
    # 2025-2026
    ('Year-End Season', '연말 시즌', 'OTHER', '2025-12-25', '2025-12-31', 'HIGH'),
    ('New Year Season', '연초 시즌', 'OTHER', '2026-01-01', '2026-01-07', 'HIGH'),
    # 2026-2027
    ('Year-End Season', '연말 시즌', 'OTHER', '2026-12-25', '2026-12-31', 'HIGH'),
    ('New Year Season', '연초 시즌', 'OTHER', '2027-01-01', '2027-01-07', 'HIGH'),

    # ═══════════ Canterbury Anniversary (Regional) ═══════════
    ('Canterbury Anniversary', '캔터베리 기념일', 'NZ_PUBLIC', '2024-11-15', '2024-11-15', 'MEDIUM'),
    ('Canterbury Anniversary', '캔터베리 기념일', 'NZ_PUBLIC', '2025-11-14', '2025-11-14', 'MEDIUM'),
    ('Canterbury Anniversary', '캔터베리 기념일', 'NZ_PUBLIC', '2026-11-13', '2026-11-13', 'MEDIUM'),
    ('Canterbury Anniversary', '캔터베리 기념일', 'NZ_PUBLIC', '2027-11-12', '2027-11-12', 'MEDIUM'),
]


class Command(BaseCommand):
    help = 'Seed holiday calendar (NZ public, NZ school, Chinese holidays) 2024-2027'

    def handle(self, *args, **options):
        from closing.models import Holiday

        created = 0
        skipped = 0

        for name, name_ko, category, start_str, end_str, impact in HOLIDAYS:
            start = date.fromisoformat(start_str)
            end = date.fromisoformat(end_str)
            year = start.year

            # Skip if already exists
            if Holiday.objects.filter(name=name, start_date=start, year=year).exists():
                skipped += 1
                continue

            Holiday.objects.create(
                name=name,
                name_ko=name_ko,
                category=category,
                start_date=start,
                end_date=end,
                year=year,
                impact=impact,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Done! Created {created} holidays, skipped {skipped} existing'))
