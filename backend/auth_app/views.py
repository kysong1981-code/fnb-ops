from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from django.db import transaction

from users.models import UserProfile, Organization, Permission, AuditLog
from users.serializers import (
    UserSerializer,
    UserProfileSerializer,
    PermissionSerializer
)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT 토큰에 사용자 프로필 정보 추가"""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # 토큰에 사용자 정보 추가
        try:
            profile = user.profile
            token['user_id'] = user.id
            token['username'] = user.username
            token['role'] = profile.role
            token['organization_id'] = profile.organization_id
            token['employee_id'] = profile.employee_id
        except UserProfile.DoesNotExist:
            pass

        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    """로그인 (JWT 토큰 발급)"""
    serializer_class = CustomTokenObtainPairSerializer
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
    """내 프로필 조회"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        로그인한 사용자의 프로필 정보 조회

        Authorization: Bearer <token>
        """
        try:
            profile = request.user.profile
            serializer = UserProfileSerializer(profile)

            return Response(
                {
                    'message': 'Profile retrieved successfully',
                    'profile': serializer.data
                },
                status=status.HTTP_200_OK
            )

        except UserProfile.DoesNotExist:
            return Response(
                {'error': 'User profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )


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
