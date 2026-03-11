from django.contrib import admin
from .models import Organization, UserProfile, Permission, Integration, AuditLog


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'level', 'region', 'phone', 'email')
    list_filter = ('level', 'region')
    search_fields = ('name',)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'employee_id', 'role', 'organization', 'employment_status', 'is_active')
    list_filter = ('role', 'employment_status', 'organization', 'is_active')
    search_fields = ('user__first_name', 'user__last_name', 'employee_id')


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'resource', 'action')
    list_filter = ('role', 'resource')


@admin.register(Integration)
class IntegrationAdmin(admin.ModelAdmin):
    list_display = ('organization', 'service', 'is_connected', 'connected_by', 'connected_at')
    list_filter = ('service', 'is_connected')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'resource', 'resource_id', 'created_at')
    list_filter = ('resource', 'created_at')
    readonly_fields = ('created_at',)
