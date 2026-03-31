from django_filters import rest_framework as filters
from rest_framework.filters import BaseFilterBackend
from .models import UserProfile


class OrganizationFilterBackend(BaseFilterBackend):
    """
    역할에 따라 쿼리셋을 자동으로 필터링하는 필터 백엔드

    사용 방법: ViewSet에 filter_backends = [OrganizationFilterBackend] 추가
    """

    def filter_queryset(self, request, queryset, view):
        """사용자의 역할에 따라 쿼리셋 필터링. CEO/HQ는 store_id로 전환 가능."""
        try:
            profile = request.user.profile
            # CEO/HQ/Enterprise/Area can filter by store_id query param
            if profile.role in ['CEO', 'HQ', 'REGIONAL_MANAGER', 'SENIOR_MANAGER']:
                store_id = request.query_params.get('store_id')
                if store_id:
                    model = queryset.model
                    if hasattr(model, 'organization'):
                        return queryset.filter(organization_id=store_id)
            return self._filter_by_role(profile, queryset)
        except (AttributeError, UserProfile.DoesNotExist):
            return queryset.none()

    @staticmethod
    def _filter_by_role(profile, queryset):
        """역할별 필터링 로직"""

        # queryset 모델 확인
        model = queryset.model
        has_organization = hasattr(model, 'organization')

        # organization 필드가 없으면 필터링하지 않음
        if not has_organization:
            # 사용자 정보 관련 쿼리셋인 경우 (UserProfile, User 등)
            if model.__name__ in ['UserProfile', 'User', 'AuditLog']:
                return queryset
            return queryset

        # role별 필터링
        if profile.role == 'EMPLOYEE':
            # EMPLOYEE: 자신의 조직 데이터만 (read-only)
            return queryset.filter(organization=profile.organization)

        elif profile.role == 'MANAGER':
            # MANAGER: 자신의 조직 데이터만
            return queryset.filter(organization=profile.organization)

        elif profile.role in ('SENIOR_MANAGER', 'REGIONAL_MANAGER'):
            # managed_stores가 있으면 그것만, 없으면 자기 조직 + 하위
            managed = profile.managed_stores.all()
            if managed.exists():
                return queryset.filter(organization__in=managed)
            region = profile.organization
            stores = region.sub_stores.all() if region else []
            org_list = [region] + list(stores)
            return queryset.filter(organization__in=org_list)

        elif profile.role in ['HQ', 'CEO']:
            # HQ, CEO: 전체 데이터
            return queryset

        return queryset


def get_target_org(request):
    """CEO/HQ가 store_id로 특정 매장 선택 시 해당 매장 org 반환.
    Settings에서 항목 생성 시 올바른 매장에 저장되도록 사용."""
    from users.models import Organization
    store_id = request.query_params.get('store_id')
    profile = request.user.profile
    if store_id and profile.role in ['CEO', 'HQ', 'REGIONAL_MANAGER', 'SENIOR_MANAGER']:
        try:
            return Organization.objects.get(id=store_id)
        except Organization.DoesNotExist:
            pass
    return profile.organization


def filter_queryset_by_role(profile, queryset):
    """
    사용자의 역할에 따라 쿼리셋을 필터링하는 유틸 함수

    사용 방법:
        queryset = DailyClosing.objects.all()
        filtered_qs = filter_queryset_by_role(request.user.profile, queryset)
    """
    return OrganizationFilterBackend._filter_by_role(profile, queryset)


class UserPermissionFilterBackend(BaseFilterBackend):
    """
    사용자 관련 쿼리셋 필터링 (UserProfile, User 등)

    - EMPLOYEE: 자신의 정보만 조회 가능
    - MANAGER: 자신의 조직의 모든 직원 정보
    - SENIOR_MANAGER/REGIONAL_MANAGER: 자신의 지역/하위 지역의 모든 직원
    - HQ/CEO: 전체 직원 정보
    """

    def filter_queryset(self, request, queryset, view):
        """사용자 정보에 따라 쿼리셋 필터링"""
        try:
            profile = request.user.profile

            if queryset.model.__name__ == 'UserProfile':
                return self._filter_user_profiles(profile, queryset)

            elif queryset.model.__name__ == 'User':
                return self._filter_users(profile, queryset)

            return queryset

        except (AttributeError, UserProfile.DoesNotExist):
            return queryset.none()

    @staticmethod
    def _filter_user_profiles(profile, queryset):
        """UserProfile 쿼리셋 필터링"""

        if profile.role == 'EMPLOYEE':
            # EMPLOYEE: 자신의 정보만
            return queryset.filter(user=profile.user)

        elif profile.role == 'MANAGER':
            # MANAGER: 자신의 조직의 모든 직원
            return queryset.filter(organization=profile.organization)

        elif profile.role in ('SENIOR_MANAGER', 'REGIONAL_MANAGER'):
            managed = profile.managed_stores.all()
            if managed.exists():
                return queryset.filter(organization__in=managed)
            region = profile.organization
            stores = region.sub_stores.all() if region else []
            org_list = [region] + list(stores)
            return queryset.filter(organization__in=org_list)

        elif profile.role in ['HQ', 'CEO']:
            # HQ, CEO: 전체 직원
            return queryset

        return queryset

    @staticmethod
    def _filter_users(profile, queryset):
        """User 쿼리셋 필터링 (User.profile로 연결)"""

        if profile.role == 'EMPLOYEE':
            return queryset.filter(profile=profile)

        elif profile.role == 'MANAGER':
            return queryset.filter(profile__organization=profile.organization)

        elif profile.role in ('SENIOR_MANAGER', 'REGIONAL_MANAGER'):
            managed = profile.managed_stores.all()
            if managed.exists():
                return queryset.filter(profile__organization__in=managed)
            region = profile.organization
            stores = region.sub_stores.all() if region else []
            org_list = [region] + list(stores)
            return queryset.filter(profile__organization__in=org_list)

        elif profile.role in ['HQ', 'CEO']:
            return queryset

        return queryset
