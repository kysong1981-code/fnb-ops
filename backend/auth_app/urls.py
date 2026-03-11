from django.urls import path
from .views import (
    CustomTokenObtainPairView,
    UserRegistrationView,
    UserProfileView,
    ChangePasswordView,
    PermissionCheckView,
)
from users.views import StoreApplicationPublicView

urlpatterns = [
    # 로그인 (JWT 토큰 발급)
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),

    # 회원가입
    path('register/', UserRegistrationView.as_view(), name='register'),

    # 내 프로필 조회/수정
    path('profile/', UserProfileView.as_view(), name='profile'),

    # 비밀번호 변경
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),

    # 권한 확인
    path('check-permission/', PermissionCheckView.as_view(), name='check_permission'),

    # 스토어 오픈 신청 (Public)
    path('store-application/', StoreApplicationPublicView.as_view(), name='store-application'),
]
