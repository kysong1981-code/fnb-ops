"""
Import daily_cash_tracking CSV into DailyClosing records.
Usage: docker exec -it fnb-ops-backend python manage.py shell < scripts/import_csv_closing.py
Or: docker exec -it fnb-ops-backend python manage.py runscript scripts.import_csv_closing
"""
import csv
import os
from datetime import datetime, date
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings_production')

import django
django.setup()

from closing.models import DailyClosing, ClosingSupplierCost, ClosingHRCash, Supplier
from users.models import Organization, UserProfile

# Config
CSV_PATH = '/app/scripts/daily_cash_tracking_2025-03_to_2026-03.csv'
STORE_NAME = 'The Sushi Platter'
END_DATE = date(2026, 3, 10)  # yesterday (2026-03-10)

org = Organization.objects.get(name=STORE_NAME)

# Get or create a default user profile for created_by
profile = UserProfile.objects.filter(organization=org).first()
if not profile:
    profile = UserProfile.objects.first()

# Get or create a generic supplier for COGS
supplier, _ = Supplier.objects.get_or_create(
    organization=org,
    code='IMPORT',
    defaults={'name': 'Imported COGS', 'contact': '', 'phone': ''}
)

created = 0
skipped = 0

with open(CSV_PATH, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        closing_date = datetime.strptime(row['Date'], '%Y-%m-%d').date()

        # Only import up to yesterday
        if closing_date > END_DATE:
            continue

        total_sales = Decimal(row['Daily Total Sales'] or '0')
        total_cogs = Decimal(row['Daily Total COGS'] or '0')
        deposit = Decimal(row['Deposit (Banking)'] or '0')
        hr_cash = Decimal(row['HR Cash (Deposit)'] or '0')

        # Skip if already exists
        if DailyClosing.objects.filter(organization=org, closing_date=closing_date).exists():
            skipped += 1
            continue

        # Create DailyClosing
        closing = DailyClosing.objects.create(
            organization=org,
            closing_date=closing_date,
            created_by=profile,
            pos_cash=total_sales,
            pos_card=Decimal('0'),
            actual_cash=total_sales,
            actual_card=Decimal('0'),
            bank_deposit=deposit,
            status='APPROVED',
        )

        # COGS as ClosingSupplierCost
        if total_cogs > 0:
            ClosingSupplierCost.objects.create(
                closing=closing,
                supplier=supplier,
                amount=total_cogs,
                description=f'Imported COGS for {closing_date}',
            )

        # HR Cash
        if hr_cash > 0:
            ClosingHRCash.objects.create(
                daily_closing=closing,
                amount=hr_cash,
                recipient_name='Imported HR Cash',
                notes=f'Imported for {closing_date}',
                created_by=profile.user,
            )

        created += 1

print(f'Import complete: {created} created, {skipped} skipped (already exist)')
