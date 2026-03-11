from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TemperatureLocationViewSet,
    SafetyChecklistTemplateViewSet, DailyChecklistResponseViewSet,
    TemperatureLogViewSet, TrainingRecordViewSet, CleaningRecordViewSet,
    SelfVerificationViewSet, IncidentViewSet, AuditLogViewSet,
    SafetyComplianceDashboardViewSet,
    SafetyRecordTypeViewSet, StoreRecordConfigViewSet, SafetyRecordViewSet
)

# Router for ViewSets
router = DefaultRouter()
router.register(r'temperature-locations', TemperatureLocationViewSet, basename='temperature-location')
router.register(r'checklist-templates', SafetyChecklistTemplateViewSet, basename='checklist-template')
router.register(r'checklists', DailyChecklistResponseViewSet, basename='daily-checklist')
router.register(r'temperatures', TemperatureLogViewSet, basename='temperature-log')
router.register(r'training', TrainingRecordViewSet, basename='training-record')
router.register(r'cleaning', CleaningRecordViewSet, basename='cleaning-record')
router.register(r'verifications', SelfVerificationViewSet, basename='self-verification')
router.register(r'incidents', IncidentViewSet, basename='incident')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'dashboard', SafetyComplianceDashboardViewSet, basename='safety-dashboard')
# MPI Food Safety Record System
router.register(r'record-types', SafetyRecordTypeViewSet, basename='record-type')
router.register(r'record-configs', StoreRecordConfigViewSet, basename='record-config')
router.register(r'records', SafetyRecordViewSet, basename='safety-record')

urlpatterns = [
    path('', include(router.urls)),
]
