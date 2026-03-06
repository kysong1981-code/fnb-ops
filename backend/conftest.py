"""
Pytest configuration and fixtures for fnb-ops backend
"""
import os
import django
import pytest
from django.conf import settings
from django.test.utils import get_runner

# Configure Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()


@pytest.fixture(scope='session')
def django_db_setup():
    """Override django db setup for tests"""
    settings.DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }


@pytest.fixture(scope='session')
def django_debug_mode():
    """Set debug mode for testing"""
    with settings.DEBUG:
        yield


@pytest.fixture
def api_client():
    """Provide Django test client"""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def authenticated_client(django_user_model):
    """Provide authenticated API client"""
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    user = django_user_model.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )

    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    return client, user


@pytest.fixture
def sample_user(django_user_model):
    """Create a sample user"""
    return django_user_model.objects.create_user(
        username='sampleuser',
        email='sample@example.com',
        password='samplepass123'
    )


@pytest.fixture
def sample_organization():
    """Create a sample organization"""
    from users.models import Organization

    return Organization.objects.create(
        name='Test Organization',
        code='TEST-ORG',
        address='123 Test St',
        city='Test City',
        country='NZ',
        timezone='Pacific/Auckland'
    )


@pytest.fixture
def sample_user_profile(sample_user, sample_organization):
    """Create a sample user profile"""
    from users.models import UserProfile

    return UserProfile.objects.create(
        user=sample_user,
        organization=sample_organization,
        role='EMPLOYEE'
    )


@pytest.fixture(autouse=True)
def reset_sequences(db):
    """Reset database sequences after each test"""
    from django.db import connection
    cursor = connection.cursor()

    # Reset sequences for all tables
    tables = connection.introspection.table_names()
    for table in tables:
        try:
            cursor.execute(f"ALTER SEQUENCE {table}_id_seq RESTART WITH 1")
        except Exception:
            pass  # Ignore errors for tables without sequences
