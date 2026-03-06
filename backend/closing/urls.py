from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DailyClosingViewSet, ClosingHRCashViewSet, ClosingCashExpenseViewSet
)

# Router for ViewSets
router = DefaultRouter()
router.register(r'closings', DailyClosingViewSet, basename='dailyclosing')
router.register(r'hr-cash', ClosingHRCashViewSet, basename='hrcash')
router.register(r'expenses', ClosingCashExpenseViewSet, basename='cashexpense')

urlpatterns = [
    path('', include(router.urls)),
]
