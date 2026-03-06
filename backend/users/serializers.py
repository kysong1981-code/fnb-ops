from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Organization, UserProfile, Permission, AuditLog


# 1. 간단한 것부터: Organization
class OrganizationSerializer(serializers.ModelSerializer):
    """조직 정보 기본 Serializer"""
    parent_name = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'level', 'parent', 'parent_name',
            'address', 'phone', 'email',
            'opening_time', 'closing_time',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


# 2. Permission
class PermissionSerializer(serializers.ModelSerializer):
    """권한 정보 Serializer"""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    resource_display = serializers.CharField(source='get_resource_display', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = Permission
        fields = [
            'id', 'role', 'role_display',
            'resource', 'resource_display',
            'action', 'action_display',
            'created_at'
        ]
        read_only_fields = ['created_at']


# 3. UserProfile (간단한 버전 - 다른 곳에서 참조할 때)
class UserProfileDetailSerializer(serializers.ModelSerializer):
    """사용자 프로필 기본 정보 (다른 Serializer에서 nested로 사용)"""
    user_first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_last_name = serializers.CharField(source='user.last_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    employment_status_display = serializers.CharField(
        source='get_employment_status_display', read_only=True
    )

    class Meta:
        model = UserProfile
        fields = [
            'id', 'employee_id', 'role', 'role_display',
            'user_first_name', 'user_last_name', 'user_email',
            'organization', 'phone',
            'employment_status', 'employment_status_display',
            'is_active'
        ]
        read_only_fields = ['created_at', 'updated_at']


# 4. User (Django User) - 로그인/가입용
class UserSerializer(serializers.ModelSerializer):
    """Django User Serializer (회원가입, 로그인용)"""

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'password']
        extra_kwargs = {
            'password': {'write_only': True},
            'id': {'read_only': True}
        }

    def create(self, validated_data):
        """회원가입시 User 생성"""
        user = User.objects.create_user(**validated_data)
        return user


# 5. 전체 UserProfile (가장 복잡)
class UserProfileSerializer(serializers.ModelSerializer):
    """사용자 전체 프로필 정보"""
    # User 정보 포함
    user = UserSerializer(read_only=True)

    # 조직 정보 (중첩)
    organization_detail = OrganizationSerializer(source='organization', read_only=True)

    # 매니저 정보
    manager_name = serializers.CharField(
        source='manager.user.get_full_name', read_only=True
    )

    # 권한 정보
    user_permissions = serializers.SerializerMethodField()

    # Display 필드
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    employment_status_display = serializers.CharField(
        source='get_employment_status_display', read_only=True
    )
    work_type_display = serializers.CharField(source='get_work_type_display', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id', 'employee_id', 'role', 'role_display',
            'user', 'organization', 'organization_detail',
            'manager', 'manager_name',
            'date_of_joining', 'phone', 'date_of_birth',
            'employment_status', 'employment_status_display',
            'tax_file_number', 'kiwisaver_status', 'kiwisaver_rate',
            'work_type', 'work_type_display',
            'is_active', 'user_permissions',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'employee_id', 'created_at', 'updated_at',
            'user', 'user_permissions'
        ]

    def get_user_permissions(self, obj):
        """사용자의 권한 목록 반환"""
        # 해당 역할의 모든 권한 조회
        permissions = Permission.objects.filter(role=obj.role)
        return PermissionSerializer(permissions, many=True).data
