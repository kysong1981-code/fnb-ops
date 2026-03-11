from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.users.models import UserProfile
from django.contrib.auth.models import User
import random

class Command(BaseCommand):
    help = 'Create sample data for the application'

    def handle(self, *args, **options):
        # Get or create admin user
        admin_user = User.objects.filter(username='admin').first()

        # Create sample employees
        employee_data = [
            {'first_name': 'John', 'last_name': 'Smith', 'username': 'john_smith', 'role': 'EMPLOYEE'},
            {'first_name': 'Sarah', 'last_name': 'Johnson', 'username': 'sarah_johnson', 'role': 'EMPLOYEE'},
            {'first_name': 'Mike', 'last_name': 'Williams', 'username': 'mike_williams', 'role': 'EMPLOYEE'},
            {'first_name': 'Emma', 'last_name': 'Davis', 'username': 'emma_davis', 'role': 'EMPLOYEE'},
            {'first_name': 'Alex', 'last_name': 'Brown', 'username': 'alex_brown', 'role': 'MANAGER'},
            {'first_name': 'Lisa', 'last_name': 'Taylor', 'username': 'lisa_taylor', 'role': 'MANAGER'},
        ]

        created_count = 0
        for emp_data in employee_data:
            user, created = User.objects.get_or_create(
                username=emp_data['username'],
                defaults={
                    'first_name': emp_data['first_name'],
                    'last_name': emp_data['last_name'],
                    'email': f"{emp_data['username']}@fnb-ops.local"
                }
            )

            if created:
                user.set_password('password123')
                user.save()

            # Create or update profile
            profile, profile_created = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'role': emp_data['role'],
                    'organization_id': 1,
                    'employment_status': 'ACTIVE',
                    'date_of_joining': timezone.now().date() - timedelta(days=random.randint(30, 365))
                }
            )

            if profile_created:
                created_count += 1

        self.stdout.write(self.style.SUCCESS(f'Created {created_count} sample employee profiles'))
        self.stdout.write(self.style.SUCCESS('Sample data created successfully!'))
        self.stdout.write(self.style.WARNING('\nSample Employee Credentials:'))
        self.stdout.write('=' * 50)
        for emp_data in employee_data:
            self.stdout.write(f"Username: {emp_data['username']:<20} Password: password123")
        self.stdout.write('=' * 50)
