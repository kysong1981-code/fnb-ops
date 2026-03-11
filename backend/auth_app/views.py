import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.html import strip_tags
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from users.models import UserProfile, Organization, Permission, AuditLog

logger = logging.getLogger(__name__)
from users.serializers import (
    UserSerializer,
    UserProfileSerializer,
    PermissionSerializer
)


class EmailTokenObtainPairSerializer(serializers.Serializer):
    """이메일 기반 JWT 토큰 발급 Serializer"""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        user = authenticate(
            request=self.context.get('request'),
            username=email,
            password=password,
        )

        if not user:
            raise serializers.ValidationError('Invalid email or password')

        if not user.is_active:
            raise serializers.ValidationError(
                'Account not activated. Please check your email for the invite link.'
            )

        refresh = RefreshToken.for_user(user)

        # 토큰에 프로필 정보 추가
        try:
            profile = user.profile
            refresh['user_id'] = user.id
            refresh['email'] = user.email
            refresh['role'] = profile.role
            refresh['organization_id'] = profile.organization_id
            refresh['employee_id'] = profile.employee_id
        except UserProfile.DoesNotExist:
            pass

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }


class CustomTokenObtainPairView(TokenObtainPairView):
    """로그인 (JWT 토큰 발급) — 이메일 기반"""
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [AllowAny]


class UserRegistrationView(APIView):
    """회원가입"""
    permission_classes = [AllowAny]

    def post(self, request):
        """
        회원가입 요청

        필수 필드:
        {
            "username": "employee001",
            "password": "password123",
            "email": "employee@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "employee_id": "EMP001",
            "role": "EMPLOYEE",
            "organization_id": 1,
            "date_of_joining": "2024-01-01"
        }
        """
        try:
            # User 생성
            user_data = {
                'username': request.data.get('username'),
                'password': request.data.get('password'),
                'email': request.data.get('email'),
                'first_name': request.data.get('first_name', ''),
                'last_name': request.data.get('last_name', ''),
            }

            # 필수 필드 검증
            if not all([user_data['username'], user_data['password'], user_data['email']]):
                return Response(
                    {'error': 'username, password, email are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 중복 체크
            if User.objects.filter(username=user_data['username']).exists():
                return Response(
                    {'error': 'Username already exists'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Transaction으로 처리
            with transaction.atomic():
                # User 생성
                user = User.objects.create_user(**user_data)

                # UserProfile 생성
                profile_data = {
                    'user': user,
                    'employee_id': request.data.get('employee_id'),
                    'role': request.data.get('role', 'EMPLOYEE'),
                    'organization_id': request.data.get('organization_id'),
                    'date_of_joining': request.data.get('date_of_joining'),
                }

                profile = UserProfile.objects.create(**profile_data)

                # AuditLog 기록
                AuditLog.objects.create(
                    user=profile,
                    action='USER_REGISTERED',
                    resource='USER',
                    resource_id=user.id,
                    ip_address=self._get_client_ip(request)
                )

            user_serializer = UserSerializer(user)
            return Response(
                {
                    'message': 'User registered successfully',
                    'user': user_serializer.data,
                    'profile_id': profile.id
                },
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @staticmethod
    def _get_client_ip(request):
        """클라이언트 IP 주소 추출"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class UserProfileView(APIView):
    """내 프로필 조회 + 수정"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """로그인한 사용자의 프로필 정보 조회"""
        try:
            profile = request.user.profile
            serializer = UserProfileSerializer(profile)
            return Response(
                {'message': 'Profile retrieved successfully', 'profile': serializer.data},
                status=status.HTTP_200_OK,
            )
        except UserProfile.DoesNotExist:
            return Response({'error': 'User profile not found'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request):
        """본인 프로필 일부 필드 수정 (phone, email, bank_account)"""
        try:
            profile = request.user.profile
            user = request.user

            profile_fields = ['phone', 'bank_account']
            for field in profile_fields:
                if field in request.data:
                    setattr(profile, field, request.data[field])

            if 'email' in request.data:
                user.email = request.data['email']
                user.save(update_fields=['email'])

            profile.save()
            serializer = UserProfileSerializer(profile)
            return Response(
                {'message': 'Profile updated', 'profile': serializer.data},
                status=status.HTTP_200_OK,
            )
        except UserProfile.DoesNotExist:
            return Response({'error': 'User profile not found'}, status=status.HTTP_404_NOT_FOUND)


class ChangePasswordView(APIView):
    """비밀번호 변경"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')

        if not current_password or not new_password:
            return Response({'error': 'Both current and new password are required'}, status=400)
        if not request.user.check_password(current_password):
            return Response({'error': 'Current password is incorrect'}, status=400)
        if len(new_password) < 6:
            return Response({'error': 'New password must be at least 6 characters'}, status=400)

        request.user.set_password(new_password)
        request.user.save()
        return Response({'message': 'Password changed successfully'})


class PermissionCheckView(APIView):
    """특정 권한 확인"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        사용자가 특정 리소스의 특정 액션에 대한 권한이 있는지 확인

        {
            "resource": "CLOSING",
            "action": "EDIT"
        }
        """
        try:
            profile = request.user.profile
            resource = request.data.get('resource')
            action = request.data.get('action')

            if not resource or not action:
                return Response(
                    {'error': 'resource and action are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 권한 확인
            has_permission = Permission.objects.filter(
                role=profile.role,
                resource=resource,
                action=action
            ).exists()

            return Response(
                {
                    'resource': resource,
                    'action': action,
                    'has_permission': has_permission,
                    'user_role': profile.role
                },
                status=status.HTTP_200_OK
            )

        except UserProfile.DoesNotExist:
            return Response(
                {'error': 'User profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class PasswordResetRequestView(APIView):
    """Request a password reset email"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Always return success to prevent email enumeration
        success_msg = {
            'message': 'If an account with that email exists, a password reset link has been sent.'
        }

        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            return Response(success_msg, status=status.HTTP_200_OK)

        # Generate token and uid
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Build reset URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://oneops.co.nz')
        reset_link = f"{frontend_url}/reset-password/{uid}/{token}"

        # Send email
        subject = 'Reset Your Oneops Password'
        html_message = render_to_string(
            'auth_app/password_reset_email.html',
            {
                'user': user,
                'reset_link': reset_link,
            },
        )
        plain_message = strip_tags(html_message)
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@oneops.co.nz')

        try:
            send_mail(
                subject,
                plain_message,
                from_email,
                [user.email],
                html_message=html_message,
                fail_silently=False,
            )
            logger.info('Password reset email sent to %s', email)
        except Exception as e:
            logger.error('Failed to send password reset email to %s: %s', email, e)
            return Response(
                {'error': 'Failed to send email. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(success_msg, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """Confirm password reset with token and new password"""
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        new_password = request.data.get('new_password', '')

        if not uid or not token or not new_password:
            return Response(
                {'error': 'uid, token, and new_password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 6:
            return Response(
                {'error': 'Password must be at least 6 characters'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Decode uid
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {'error': 'Invalid reset link'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify token
        if not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'Reset link has expired or is invalid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Set new password
        user.set_password(new_password)
        user.save()

        logger.info('Password reset successful for user %s', user.email)

        return Response(
            {'message': 'Password has been reset successfully'},
            status=status.HTTP_200_OK,
        )
