from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from .models import DocumentCategory, Document, DocumentDownload
from .serializers import (
    DocumentCategorySerializer,
    DocumentSerializer,
    DocumentDetailSerializer,
    DocumentDownloadSerializer,
    DocumentVersionSerializer
)


class DocumentCategoryViewSet(viewsets.ModelViewSet):
    """문서 카테고리 ViewSet"""
    queryset = DocumentCategory.objects.all()
    serializer_class = DocumentCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering = ['name']

    def get_permissions(self):
        """카테고리 생성/수정/삭제는 Manager 이상만"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Manager 이상의 권한 확인 필요
            # TODO: 권한 클래스 추가 (IsManager)
            pass
        return super().get_permissions()


class DocumentViewSet(viewsets.ModelViewSet):
    """문서 ViewSet (CRUD + 특수 액션)"""
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'document_type', 'is_public', 'is_latest']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'title', 'version']
    ordering = ['-created_at']

    def get_queryset(self):
        """사용자의 조직에 맞는 문서만 반환"""
        user = self.request.user
        if not hasattr(user, 'userprofile'):
            return Document.objects.none()

        user_profile = user.profile
        organization = user_profile.organization

        # Employee: 공개 문서만 (is_public=True)
        # Manager+: 자신의 조직 모든 문서
        if user_profile.role in ['MANAGER', 'SENIOR_MANAGER']:
            return Document.objects.filter(organization=organization)
        elif user_profile.role in ['REGIONAL_MANAGER', 'HQ']:
            # Regional Manager: 지역 내 모든 조직의 문서
            # HQ: 전체 문서
            return Document.objects.all()
        else:
            # Employee: 공개 문서만
            return Document.objects.filter(Q(is_public=True) | Q(organization=organization))

    def get_serializer_class(self):
        """액션별로 다른 Serializer 사용"""
        if self.action == 'retrieve':
            return DocumentDetailSerializer
        elif self.action == 'versions':
            return DocumentVersionSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        """문서 생성 시 organization과 created_by 자동 설정"""
        user_profile = self.request.user.profile
        serializer.save(
            organization=user_profile.organization,
            created_by=user_profile
        )

    def perform_update(self, serializer):
        """문서 업로드 시 버전 관리"""
        instance = self.get_object()

        # 파일이 변경되면 새 버전으로 저장
        if 'file' in serializer.validated_data and serializer.validated_data['file'] != instance.file:
            # 기존 버전의 is_latest를 False로 설정
            instance.is_latest = False
            instance.save()

            # 새 버전 생성
            new_version = instance.version + 1
            serializer.validated_data['version'] = new_version
            serializer.validated_data['is_latest'] = True

        serializer.save()

    @action(detail=True, methods=['post'])
    def download(self, request, pk=None):
        """파일 다운로드 및 다운로드 이력 기록"""
        document = self.get_object()

        # 권한 확인: is_public 또는 manager+
        user_profile = request.user.profile
        if not document.is_public and user_profile.organization != document.organization:
            return Response(
                {'detail': '이 문서에 접근할 수 없습니다.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 다운로드 이력 기록
        DocumentDownload.objects.create(
            document=document,
            downloaded_by=user_profile
        )

        # 파일 URL 반환 (클라이언트에서 직접 다운로드하도록)
        return Response({
            'file_url': document.file.url,
            'filename': document.file.name.split('/')[-1],
            'title': document.title,
            'version': document.version
        })

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """특정 문서의 모든 버전 조회"""
        document = self.get_object()

        # 같은 제목의 모든 문서 버전 조회
        versions = Document.objects.filter(
            title=document.title,
            organization=document.organization
        ).order_by('-version')

        serializer = self.get_serializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """최근 문서 목록 (최대 10개)"""
        queryset = self.get_queryset()[:10]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class DocumentDownloadViewSet(viewsets.ReadOnlyModelViewSet):
    """문서 다운로드 이력 ViewSet (읽기 전용)"""
    serializer_class = DocumentDownloadSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['document', 'downloaded_by']
    ordering = ['-downloaded_at']

    def get_queryset(self):
        """사용자의 조직 다운로드 이력만 반환"""
        user = self.request.user
        if not hasattr(user, 'userprofile'):
            return DocumentDownload.objects.none()

        user_profile = user.profile

        # 자신의 조직 문서의 다운로드 이력만 조회 가능
        return DocumentDownload.objects.filter(
            document__organization=user_profile.organization
        )
