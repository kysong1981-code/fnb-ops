from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SalaryViewSet, PayPeriodViewSet, PaySlipViewSet

# Router for ViewSets
router = DefaultRouter()
router.register(r'salaries', SalaryViewSet, basename='salary')
router.register(r'pay-periods', PayPeriodViewSet, basename='pay-period')
router.register(r'payslips', PaySlipViewSet, basename='payslip')

urlpatterns = [
    path('', include(router.urls)),
]
