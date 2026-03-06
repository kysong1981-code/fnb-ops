from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentCategoryViewSet, DocumentViewSet, DocumentDownloadViewSet

router = DefaultRouter()
router.register(r'categories', DocumentCategoryViewSet, basename='category')
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'downloads', DocumentDownloadViewSet, basename='download')

urlpatterns = [
    path('', include(router.urls)),
]
