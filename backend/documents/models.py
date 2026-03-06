from django.db import models
from users.models import Organization, UserProfile


class DocumentCategory(models.Model):
    """문서 카테고리"""
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Document(models.Model):
    """자료 라이브러리 - 모든 문서 관리"""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='documents')
    category = models.ForeignKey(DocumentCategory, on_delete=models.SET_NULL, null=True, blank=True)

    # 문서 정보
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    document_type = models.CharField(
        max_length=50,
        choices=[
            ('CONTRACT', 'Contract'),
            ('JOB_DESCRIPTION', 'Job Description'),
            ('JOB_OFFER', 'Job Offer'),
            ('POLICY', 'Policy'),
            ('MANUAL', 'Manual'),
            ('TRAINING', 'Training Material'),
            ('SAFETY', 'Safety Document'),
            ('OTHER', 'Other'),
        ]
    )

    # 파일
    file = models.FileField(upload_to='documents/%Y/%m/%d/')
    file_size = models.IntegerField(null=True, blank=True)  # bytes

    # 버전 관리
    version = models.IntegerField(default=1)
    is_latest = models.BooleanField(default=True)

    # 메타데이터
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='documents_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 접근 제어
    is_public = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'document_type']),
            models.Index(fields=['category', 'is_latest']),
        ]

    def __str__(self):
        return f"{self.title} (v{self.version})"


class DocumentDownload(models.Model):
    """문서 다운로드 이력"""
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='downloads')
    downloaded_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True)
    downloaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-downloaded_at']
        indexes = [
            models.Index(fields=['document', 'downloaded_at']),
        ]

    def __str__(self):
        return f"{self.document.title} - {self.downloaded_by.user.get_full_name()} - {self.downloaded_at}"
