from django.urls import path
from .views import (
    CustomTokenObtainPairView,
    UserRegistrationView,
    UserProfileView,
    PermissionCheckView,
)

urlpatterns = [
    # 로그인 (JWT 토큰 발급)
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),

    # 회원가입
    path('register/', UserRegistrationView.as_view(), name='register'),

    # 내 프로필 조회
    path('profile/', UserProfileView.as_view(), name='profile'),

    # 권한 확인
    path('check-permission/', PermissionCheckView.as_view(), name='check_permission'),
]
