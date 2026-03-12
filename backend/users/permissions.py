from rest_framework.permissions import BasePermission
from .models import Permission, UserProfile


class BaseRolePermission(BasePermission):
    """역할 기반 권한 검증의 기본 클래스"""

    allowed_roles = []

    def has_permission(self, request, view):
        """사용자가 특정 역할을 가지고 있는지 확인"""
        try:
            profile = request.user.profile
            return profile.role in self.allowed_roles
        except (AttributeError, UserProfile.DoesNotExist):
            return False

    def has_object_permission(self, request, view, obj):
        """객체에 대한 접근 권한 확인"""
        return self.has_permission(request, view)


class IsEmployee(BaseRolePermission):
    """EMPLOYEE 이상의 역할 필요"""
    allowed_roles = ['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']


class IsManager(BaseRolePermission):
    """MANAGER 이상의 역할 필요 (같은 조직 데이터만 접근)"""
    allowed_roles = ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']

    def has_object_permission(self, request, view, obj):
        """객체 레벨 권한 확인"""
        if not self.has_permission(request, view):
            return False

        try:
            profile = request.user.profile
            # CEO/HQ can access all organizations
            if profile.role in ['CEO', 'HQ']:
                return True
            # obj에 organization 필드가 있는지 확인
            if hasattr(obj, 'organization'):
                return obj.organization == profile.organization
            return True
        except (AttributeError, UserProfile.DoesNotExist):
            return False


class IsSeniorManager(BaseRolePermission):
    """SENIOR_MANAGER 이상의 역할 필요 (같은 지역 데이터 접근)"""
    allowed_roles = ['SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']

    def has_object_permission(self, request, view, obj):
        """객체 레벨 권한 확인"""
        if not self.has_permission(request, view):
            return False

        try:
            profile = request.user.profile
            # SENIOR_MANAGER는 같은 지역의 매장들만 접근 가능
            if profile.role == 'SENIOR_MANAGER':
                if hasattr(obj, 'organization'):
                    # obj의 organization이 사용자의 organization 또는 그 부모 지역 하위에 있는지 확인
                    user_org = profile.organization
                    obj_org = obj.organization

                    # 같은 조직이거나, obj_org의 부모가 user_org인 경우
                    return obj_org == user_org or obj_org.parent == user_org
            else:
                # REGIONAL_MANAGER, HQ, CEO는 모든 데이터 접근 가능
                return True
        except (AttributeError, UserProfile.DoesNotExist):
            return False


class IsRegionalManager(BaseRolePermission):
    """REGIONAL_MANAGER 이상의 역할 필요 (지역 내 모든 데이터 접근)"""
    allowed_roles = ['REGIONAL_MANAGER', 'HQ', 'CEO']

    def has_object_permission(self, request, view, obj):
        """객체 레벨 권한 확인"""
        if not self.has_permission(request, view):
            return False

        try:
            profile = request.user.profile
            # REGIONAL_MANAGER는 자신의 지역 및 하위 매장들의 데이터만 접근 가능
            if profile.role == 'REGIONAL_MANAGER':
                if hasattr(obj, 'organization'):
                    user_org = profile.organization
                    obj_org = obj.organization

                    # obj_org가 user_org이거나 user_org의 자식인지 확인
                    return obj_org == user_org or obj_org.parent == user_org
            else:
                # HQ, CEO는 모든 데이터 접근 가능
                return True
        except (AttributeError, UserProfile.DoesNotExist):
            return False


class IsHQ(BaseRolePermission):
    """HQ 이상의 역할 필요 (전체 데이터 접근)"""
    allowed_roles = ['HQ', 'CEO']


class IsCEO(BaseRolePermission):
    """CEO 역할만 필요"""
    allowed_roles = ['CEO']


class HasResourcePermission(BasePermission):
    """특정 리소스의 특정 액션에 대한 권한 확인"""

    def has_permission(self, request, view):
        """Permission 모델을 기반으로 권한 확인"""
        try:
            profile = request.user.profile

            # view에서 required_resource와 required_action 속성을 확인
            resource = getattr(view, 'required_resource', None)
            action = getattr(view, 'required_action', None)

            if not resource or not action:
                return True  # 리소스나 액션이 정의되지 않으면 통과

            # Permission 모델에서 권한 확인
            has_permission = Permission.objects.filter(
                role=profile.role,
                resource=resource,
                action=action
            ).exists()

            return has_permission

        except (AttributeError, UserProfile.DoesNotExist):
            return False


class IsOwnerOrManager(BasePermission):
    """자신의 데이터이거나 Manager 이상의 역할"""

    def has_object_permission(self, request, view, obj):
        """객체 레벨 권한 확인"""
        try:
            profile = request.user.profile

            # 자신의 데이터인 경우
            if hasattr(obj, 'user') and obj.user == request.user:
                return True

            # MANAGER 이상의 역할
            if profile.role in ['MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER', 'HQ', 'CEO']:
                # CEO/HQ can access all organizations
                if profile.role in ['CEO', 'HQ']:
                    return True
                if hasattr(obj, 'organization'):
                    return obj.organization == profile.organization

            return False

        except (AttributeError, UserProfile.DoesNotExist):
            return False


class CanDeleteData(BasePermission):
    """데이터 삭제 권한 (일반적으로 제한적으로 허용)"""

    def has_permission(self, request, view):
        """DELETE 요청 확인"""
        if request.method == 'DELETE':
            try:
                profile = request.user.profile
                # CEO와 HQ만 삭제 가능
                return profile.role in ['HQ', 'CEO']
            except (AttributeError, UserProfile.DoesNotExist):
                return False
        return True
