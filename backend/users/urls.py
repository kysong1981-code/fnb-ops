from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationSettingsView, StoreListView, IntegrationListView,
    integration_connect, integration_disconnect, integration_test,
    integration_sync, integration_store_select,
    StoreApplicationAdminViewSet,
)

router = DefaultRouter()
router.register(r'store-applications', StoreApplicationAdminViewSet, basename='store-application')

urlpatterns = [
    path('stores/', StoreListView.as_view(), name='store-list'),
    path('organization/settings/', OrganizationSettingsView.as_view(), name='organization-settings'),
    path('integrations/', IntegrationListView.as_view(), name='integration-list'),
    path('integrations/<str:service>/connect/', integration_connect, name='integration-connect'),
    path('integrations/<str:service>/disconnect/', integration_disconnect, name='integration-disconnect'),
    path('integrations/<str:service>/test/', integration_test, name='integration-test'),
    path('integrations/<str:service>/sync/', integration_sync, name='integration-sync'),
    path('integrations/<str:service>/store-select/', integration_store_select, name='integration-store-select'),
    path('', include(router.urls)),
]
