from rest_framework import serializers
from .models import Sales
from users.models import UserProfile


class SalesSerializer(serializers.ModelSerializer):
    """매출 데이터 시리얼라이저"""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = Sales
        fields = [
            'id', 'organization', 'organization_name',
            'date', 'time', 'amount',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'organization_name', 'created_by_name']
        extra_kwargs = {
            'created_by': {'write_only': True}
        }

    def validate_amount(self, value):
        """매출 금액은 양수여야 함"""
        if value <= 0:
            raise serializers.ValidationError("매출 금액은 0보다 커야 합니다.")
        return value

    def create(self, validated_data):
        """created_by를 현재 사용자의 프로필로 자동 설정"""
        request = self.context.get('request')
        if request and request.user:
            try:
                validated_data['created_by'] = request.user.profile
            except UserProfile.DoesNotExist:
                pass
        return super().create(validated_data)
