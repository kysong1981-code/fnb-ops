from rest_framework import serializers
from .models import DocumentCategory, Document, DocumentDownload
from users.models import UserProfile


class DocumentCategorySerializer(serializers.ModelSerializer):
    """문서 카테고리 Serializer"""
    class Meta:
        model = DocumentCategory
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['created_at']


class DocumentDownloadSerializer(serializers.ModelSerializer):
    """문서 다운로드 이력 Serializer (읽기 전용)"""
    downloaded_by_name = serializers.CharField(source='downloaded_by.user.get_full_name', read_only=True)
    document_title = serializers.CharField(source='document.title', read_only=True)

    class Meta:
        model = DocumentDownload
        fields = ['id', 'document', 'document_title', 'downloaded_by', 'downloaded_by_name', 'downloaded_at']
        read_only_fields = ['downloaded_by', 'downloaded_at']


class DocumentSerializer(serializers.ModelSerializer):
    """문서 Serializer (CRUD용)"""
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    download_count = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'organization', 'category', 'category_name',
            'title', 'description', 'document_type',
            'file', 'file_size', 'version', 'is_latest',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'is_public', 'download_count'
        ]
        read_only_fields = ['organization', 'created_by', 'created_at', 'updated_at', 'is_latest', 'file_size']

    def get_download_count(self, obj):
        """다운로드 수 계산"""
        return obj.downloads.count()


class DocumentDetailSerializer(serializers.ModelSerializer):
    """문서 상세 Serializer (중첩된 정보 포함)"""
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True)
    category_data = DocumentCategorySerializer(source='category', read_only=True)
    downloads = DocumentDownloadSerializer(many=True, read_only=True)
    download_count = serializers.SerializerMethodField()
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)

    class Meta:
        model = Document
        fields = [
            'id', 'organization', 'category', 'category_data',
            'title', 'description', 'document_type', 'document_type_display',
            'file', 'file_size', 'version', 'is_latest',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'is_public', 'download_count', 'downloads'
        ]
        read_only_fields = ['organization', 'created_by', 'created_at', 'updated_at', 'is_latest', 'downloads']

    def get_download_count(self, obj):
        """다운로드 수 계산"""
        return obj.downloads.count()


class DocumentVersionSerializer(serializers.ModelSerializer):
    """문서 버전 이력 Serializer"""
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True)

    class Meta:
        model = Document
        fields = ['id', 'version', 'is_latest', 'created_by', 'created_by_name', 'created_at', 'file']
        read_only_fields = ['created_by', 'created_at']
