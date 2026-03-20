from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DailyClosingViewSet, ClosingHRCashViewSet, ClosingCashExpenseViewSet,
    SupplierViewSet, SalesCategoryViewSet,
    ClosingSupplierCostViewSet, ClosingOtherSaleViewSet,
    SupplierMonthlyStatementViewSet, MonthlyCloseViewSet,
    CQAccountBalanceViewSet, CQExpenseViewSet, CQTransactionViewSet,
    SalesAnalysisViewSet
)
from .import_views import ImportDataView, ImportTemplateView

# Router for ViewSets
router = DefaultRouter()
router.register(r'closings', DailyClosingViewSet, basename='dailyclosing')
router.register(r'hr-cash', ClosingHRCashViewSet, basename='hrcash')
router.register(r'expenses', ClosingCashExpenseViewSet, basename='cashexpense')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'sales-categories', SalesCategoryViewSet, basename='salescategory')
router.register(r'supplier-costs', ClosingSupplierCostViewSet, basename='suppliercost')
router.register(r'other-sales', ClosingOtherSaleViewSet, basename='othersale')
router.register(r'supplier-statements', SupplierMonthlyStatementViewSet, basename='supplierstatement')
router.register(r'monthly-close', MonthlyCloseViewSet, basename='monthlyclose')
router.register(r'cq-balance', CQAccountBalanceViewSet, basename='cqbalance')
router.register(r'cq-expenses', CQExpenseViewSet, basename='cqexpense')
router.register(r'cq-transactions', CQTransactionViewSet, basename='cqtransaction')
router.register(r'sales-analysis', SalesAnalysisViewSet, basename='salesanalysis')

urlpatterns = [
    path('', include(router.urls)),
    path('import-data/', ImportDataView.as_view(), name='import-data'),
    path('import-template/', ImportTemplateView.as_view(), name='import-template'),
]
