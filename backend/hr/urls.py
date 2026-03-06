from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OnboardingViewSet, OnboardingTaskViewSet, EmployeeDocumentViewSet,
    RosterViewSet, TimesheetViewSet
)

# Router for ViewSets
router = DefaultRouter()
router.register(r'onboardings', OnboardingViewSet, basename='onboarding')
router.register(r'tasks', OnboardingTaskViewSet, basename='onboarding-task')
router.register(r'documents', EmployeeDocumentViewSet, basename='employee-document')
router.register(r'rosters', RosterViewSet, basename='roster')
router.register(r'timesheets', TimesheetViewSet, basename='timesheet')

urlpatterns = [
    path('', include(router.urls)),
]
