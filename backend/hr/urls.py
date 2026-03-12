from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OnboardingViewSet, OnboardingTaskViewSet, EmployeeDocumentViewSet,
    ShiftTemplateViewSet, RosterViewSet, TimesheetViewSet, TaskViewSet, TeamViewSet,
    EmployeeInviteViewSet, AcceptInviteView, DocumentTemplateViewSet,
    TrainingModuleViewSet, IR330ViewSet, SaveBankAccountView, InquiryViewSet,
    ResignationRequestViewSet,
)

# Router for ViewSets
router = DefaultRouter()
router.register(r'onboardings', OnboardingViewSet, basename='onboarding')
router.register(r'onboarding-tasks', OnboardingTaskViewSet, basename='onboarding-task')
router.register(r'documents', EmployeeDocumentViewSet, basename='employee-document')
router.register(r'shift-templates', ShiftTemplateViewSet, basename='shift-template')
router.register(r'rosters', RosterViewSet, basename='roster')
router.register(r'timesheets', TimesheetViewSet, basename='timesheet')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'team', TeamViewSet, basename='team')
router.register(r'invites', EmployeeInviteViewSet, basename='employee-invite')
router.register(r'document-templates', DocumentTemplateViewSet, basename='document-template')
router.register(r'training-modules', TrainingModuleViewSet, basename='training-module')
router.register(r'ir330', IR330ViewSet, basename='ir330')
router.register(r'inquiries', InquiryViewSet, basename='inquiry')
router.register(r'resignation-requests', ResignationRequestViewSet, basename='resignation-request')

urlpatterns = [
    path('', include(router.urls)),
    path('accept-invite/', AcceptInviteView.as_view(), name='accept-invite'),
    path('save-bank-account/', SaveBankAccountView.as_view(), name='save-bank-account'),
]
