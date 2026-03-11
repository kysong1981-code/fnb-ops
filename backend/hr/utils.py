import secrets
import string
from django.contrib.auth.models import User


def generate_temp_password(length=10):
    """Generate a readable temporary password (letters + digits)"""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def generate_username_from_email(email):
    """Generate a unique username from email prefix + random hex"""
    prefix = email.split('@')[0][:20]  # limit prefix length
    suffix = secrets.token_hex(2)  # 4 hex chars
    username = f"{prefix}_{suffix}"

    # Ensure uniqueness
    while User.objects.filter(username=username).exists():
        suffix = secrets.token_hex(2)
        username = f"{prefix}_{suffix}"
    return username
