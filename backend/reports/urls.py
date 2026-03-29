from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReportViewSet, GeneratedReportViewSet, SkyReportViewSet, StoreEvaluationViewSet, ProfitShareViewSet

# Router for ViewSets
router = DefaultRouter()
router.register(r'sky-reports', SkyReportViewSet, basename='sky-report')
router.register(r'store-evaluations', StoreEvaluationViewSet, basename='store-evaluation')
router.register(r'profit-shares', ProfitShareViewSet, basename='profit-share')
router.register(r'generated', GeneratedReportViewSet, basename='generated_report')
router.register(r'', ReportViewSet, basename='report')

urlpatterns = [
    path('', include(router.urls)),
]
