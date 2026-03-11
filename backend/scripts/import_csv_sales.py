"""
Import daily_cash_tracking CSV into Sales records.
Usage: docker exec -it fnb-ops-backend sh -c "python manage.py shell < /app/scripts/import_csv_sales.py"
"""
import csv
from datetime import datetime, date
from decimal import Decimal

from sales.models import Sales
from users.models import Organization, UserProfile

# Config
CSV_PATH = '/app/scripts/daily_cash_tracking_2025-03_to_2026-03.csv'
STORE_NAME = 'The Sushi Platter'
END_DATE = date(2026, 3, 10)  # yesterday

org = Organization.objects.get(name=STORE_NAME)

profile = UserProfile.objects.filter(organization=org).first()
if not profile:
    profile = UserProfile.objects.first()

created = 0
skipped = 0

with open(CSV_PATH, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        sales_date = datetime.strptime(row['Date'], '%Y-%m-%d').date()

        if sales_date > END_DATE:
            continue

        total_sales = Decimal(row['Daily Total Sales'] or '0')

        if total_sales == 0:
            continue

        # Skip if already exists
        if Sales.objects.filter(organization=org, date=sales_date).exists():
            skipped += 1
            continue

        Sales.objects.create(
            organization=org,
            date=sales_date,
            amount=total_sales,
            created_by=profile,
        )

        created += 1

print(f'Sales import complete: {created} created, {skipped} skipped')
