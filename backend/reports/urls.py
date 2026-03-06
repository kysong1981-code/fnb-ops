from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReportViewSet, GeneratedReportViewSet

# Router for ViewSets
router = DefaultRouter()
router.register(r'', ReportViewSet, basename='report')
router.register(r'generated', GeneratedReportViewSet, basename='generated_report')

urlpatterns = [
    path('', include(router.urls)),
]
