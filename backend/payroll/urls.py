from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SalaryViewSet, PayPeriodViewSet, PaySlipViewSet,
    PublicHolidayViewSet, LeaveBalanceViewSet, LeaveRequestViewSet,
    PayDayFilingViewSet,
)

# Router for ViewSets
router = DefaultRouter()
router.register(r'salaries', SalaryViewSet, basename='salary')
router.register(r'pay-periods', PayPeriodViewSet, basename='pay-period')
router.register(r'payslips', PaySlipViewSet, basename='payslip')
router.register(r'public-holidays', PublicHolidayViewSet, basename='public-holiday')
router.register(r'leave-balances', LeaveBalanceViewSet, basename='leave-balance')
router.register(r'leave-requests', LeaveRequestViewSet, basename='leave-request')
router.register(r'payday-filing', PayDayFilingViewSet, basename='payday-filing')

urlpatterns = [
    path('', include(router.urls)),
]
