#!/bin/bash
# ============================================================================
# Database Migration Script for fnb-ops
# ============================================================================
# This script runs Django migrations and prepares the application for production
# Usage: bash migrate.sh
# ============================================================================

set -e

echo "=========================================="
echo "fnb-ops Database Migration Script"
echo "=========================================="
echo ""

# Check if we're in the correct directory
if [ ! -f "manage.py" ]; then
    echo "Error: manage.py not found. Please run this script from the backend directory."
    exit 1
fi

echo "[1/4] Running Django migrations..."
python manage.py migrate
echo "✓ Migrations completed"
echo ""

echo "[2/4] Collecting static files..."
python manage.py collectstatic --noinput --clear
echo "✓ Static files collected"
echo ""

echo "[3/4] Creating default groups and permissions..."
python manage.py shell << EOF
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType

# Define role groups
roles = {
    'Employee': [],
    'Manager': [],
    'Senior Manager': [],
    'Regional Manager': [],
    'HQ': [],
    'CEO': [],
}

for role_name in roles.keys():
    group, created = Group.objects.get_or_create(name=role_name)
    if created:
        print(f"✓ Created group: {role_name}")
    else:
        print(f"✓ Group already exists: {role_name}")

print("\nDefault groups initialized successfully")
EOF
echo ""

echo "[4/4] Creating superuser (if needed)..."
python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()

if not User.objects.filter(is_superuser=True).exists():
    print("\nNo superuser found. Create one manually with:")
    print("  python manage.py createsuperuser")
else:
    print("✓ Superuser already exists")
EOF
echo ""

echo "=========================================="
echo "✓ Migration completed successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Create a superuser: python manage.py createsuperuser"
echo "2. Create organizations in the admin panel"
echo "3. Start the development server: python manage.py runserver"
