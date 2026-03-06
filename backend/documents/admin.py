from django.contrib import admin
from .models import DocumentCategory, Document, DocumentDownload


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    """문서 카테고리 Admin"""
    list_display = ('name', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('created_at',)


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    """문서 Admin"""
    list_display = ('title', 'document_type', 'category', 'version', 'is_latest', 'created_by', 'created_at')
    list_filter = ('document_type', 'category', 'is_latest', 'is_public', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('created_by', 'created_at', 'updated_at', 'is_latest', 'version', 'file_size')
    fieldsets = (
        ('기본 정보', {
            'fields': ('organization', 'title', 'description', 'category', 'document_type')
        }),
        ('파일', {
            'fields': ('file', 'file_size')
        }),
        ('버전 관리', {
            'fields': ('version', 'is_latest')
        }),
        ('공개 설정', {
            'fields': ('is_public',)
        }),
        ('메타데이터', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        """저장 시 생성자 자동 설정"""
        if not change:  # 새로 생성할 때만
            obj.created_by = request.user.userprofile
        super().save_model(request, obj, form, change)


@admin.register(DocumentDownload)
class DocumentDownloadAdmin(admin.ModelAdmin):
    """문서 다운로드 이력 Admin (읽기 전용)"""
    list_display = ('document', 'downloaded_by', 'downloaded_at')
    list_filter = ('downloaded_at', 'document__category')
    search_fields = ('document__title', 'downloaded_by__user__username', 'downloaded_by__user__first_name')
    readonly_fields = ('document', 'downloaded_by', 'downloaded_at')
    can_delete = False

    def has_add_permission(self, request):
        """다운로드 이력은 시스템에서만 생성되므로 수동 추가 불가"""
        return False

    def has_change_permission(self, request, obj=None):
        """다운로드 이력은 수정 불가"""
        return False
