import logging
from datetime import date, datetime, timedelta

from rest_framework import generics, status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .models import Organization, UserProfile, Integration, StoreApplication, JobTitle
from .serializers import OrganizationSerializer, IntegrationSerializer, StoreApplicationSerializer, JobTitleSerializer
from .permissions import IsManager
from .filters import OrganizationFilterBackend, get_target_org

logger = logging.getLogger(__name__)


class StoreListView(generics.ListAPIView):
    """역할별 스토어 목록:
    CEO/HQ: 모든 스토어
    REGIONAL_MANAGER/SENIOR_MANAGER: managed_stores
    MANAGER/EMPLOYEE: 자기 스토어만
    """
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        profile = self.request.user.profile
        if profile.role in ('CEO', 'HQ', 'ADMIN'):
            return Organization.objects.filter(level='STORE').order_by('name')
        if profile.role in ('REGIONAL_MANAGER', 'SENIOR_MANAGER'):
            managed = profile.managed_stores.all()
            if managed.exists():
                return managed.order_by('name')
        return Organization.objects.filter(id=profile.organization_id)


class AssignStoresView(APIView):
    """CEO/HQ: 매니저에게 스토어 배정 + 역할 변경"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if profile.role not in ('CEO', 'HQ', 'ADMIN'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        store_ids = request.data.get('store_ids', [])
        new_role = request.data.get('role')  # Optional role change

        try:
            target_profile = UserProfile.objects.get(id=user_id)
        except UserProfile.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # If role change requested
        if new_role:
            allowed_roles = ['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'REGIONAL_MANAGER']
            if new_role not in allowed_roles:
                return Response({'error': f'Invalid role. Allowed: {allowed_roles}'}, status=status.HTTP_400_BAD_REQUEST)
            target_profile.role = new_role
            # Clear managed_stores if demoted to non-manager role
            if new_role not in ('REGIONAL_MANAGER', 'SENIOR_MANAGER'):
                target_profile.managed_stores.clear()
                store_ids = []
            target_profile.save()

        # Assign stores (only for Enterprise/Area Managers)
        if store_ids and target_profile.role in ('REGIONAL_MANAGER', 'SENIOR_MANAGER'):
            stores = Organization.objects.filter(id__in=store_ids, level='STORE')
            target_profile.managed_stores.set(stores)
        elif not new_role:
            # If no role change and just store assignment, check role
            if target_profile.role not in ('REGIONAL_MANAGER', 'SENIOR_MANAGER'):
                return Response({'error': 'Can only assign stores to Enterprise/Area Managers'}, status=status.HTTP_400_BAD_REQUEST)
            stores = Organization.objects.filter(id__in=store_ids, level='STORE')
            target_profile.managed_stores.set(stores)

        return Response({
            'message': f'Updated {target_profile.user.get_full_name() or target_profile.user.email}',
            'role': target_profile.role,
            'managed_stores': OrganizationSerializer(target_profile.managed_stores.all(), many=True).data
        })

    def get(self, request):
        """Get all staff with their roles and assigned stores"""
        profile = request.user.profile
        if profile.role not in ('CEO', 'HQ', 'ADMIN'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        # Return all users except CEO/HQ/ADMIN
        profiles = UserProfile.objects.exclude(
            role__in=['CEO', 'HQ', 'ADMIN']
        ).select_related('user', 'organization')

        result = []
        for m in profiles:
            result.append({
                'id': m.id,
                'name': m.user.get_full_name() or m.user.email,
                'email': m.user.email,
                'role': m.role,
                'role_display': m.get_role_display(),
                'organization': m.organization.name if m.organization else None,
                'managed_stores': OrganizationSerializer(m.managed_stores.all(), many=True).data
            })

        return Response(result)


class OrganizationSettingsView(generics.RetrieveUpdateAPIView):
    """매장 설정 조회/수정 (자기 조직만)"""
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsManager]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_object(self):
        return self.request.user.profile.organization


class IntegrationListView(generics.ListAPIView):
    """List all integrations for the user's organization"""
    serializer_class = IntegrationSerializer
    permission_classes = [IsAuthenticated, IsManager]

    def get_queryset(self):
        org = self.request.user.profile.organization
        # Ensure all 3 integration records exist
        for service_code, _ in Integration._meta.get_field('service').choices:
            Integration.objects.get_or_create(
                organization=org, service=service_code
            )
        return Integration.objects.filter(organization=org)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsManager])
def integration_connect(request, service):
    """Connect an integration with API key"""
    org = request.user.profile.organization
    service = service.upper()

    valid_services = [c[0] for c in Integration._meta.get_field('service').choices]
    if service not in valid_services:
        return Response({'error': 'Invalid service'}, status=status.HTTP_400_BAD_REQUEST)

    integration, _ = Integration.objects.get_or_create(
        organization=org, service=service
    )

    api_key = request.data.get('api_key', '')
    api_secret = request.data.get('api_secret', '')
    config = request.data.get('config', {})

    integration.api_key = api_key
    integration.api_secret = api_secret
    integration.config = config
    integration.is_connected = True
    integration.connected_by = request.user.profile
    integration.connected_at = timezone.now()
    integration.save()

    return Response(IntegrationSerializer(integration).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsManager])
def integration_disconnect(request, service):
    """Disconnect an integration"""
    org = request.user.profile.organization
    service = service.upper()

    try:
        integration = Integration.objects.get(organization=org, service=service)
    except Integration.DoesNotExist:
        return Response({'error': 'Integration not found'}, status=status.HTTP_404_NOT_FOUND)

    integration.is_connected = False
    integration.api_key = None
    integration.api_secret = None
    integration.access_token = None
    integration.refresh_token = None
    integration.token_expires_at = None
    integration.connected_by = None
    integration.connected_at = None
    integration.save()

    return Response(IntegrationSerializer(integration).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsManager])
def integration_test(request, service):
    """Test an integration connection"""
    org = request.user.profile.organization
    service = service.upper()

    try:
        integration = Integration.objects.get(organization=org, service=service)
    except Integration.DoesNotExist:
        return Response({'error': 'Integration not found'}, status=status.HTTP_404_NOT_FOUND)

    if not integration.is_connected:
        return Response({'success': False, 'message': 'Integration is not connected'})

    # Service-specific connection test
    if service == 'GOMENU':
        try:
            from integrations.gomenu import create_client_from_integration
            client = create_client_from_integration(integration)
            success, data = client.test_connection()
            return Response({
                'success': success,
                'message': data.get('message', 'Test completed'),
                'service': service,
                'store_count': data.get('store_count', 0),
                'store_list': data.get('store_list', []),
            })
        except Exception as e:
            logger.exception('GoMenu test connection error')
            return Response({
                'success': False,
                'message': f'Connection error: {str(e)}',
                'service': service,
            })

    # Default: return success if connected
    return Response({
        'success': True,
        'message': f'{integration.get_service_display()} connection is active',
        'service': service,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsManager])
def integration_sync(request, service):
    """Sync data from a connected integration (e.g., GoMenu daily sales)"""
    org = request.user.profile.organization
    service = service.upper()

    try:
        integration = Integration.objects.get(organization=org, service=service)
    except Integration.DoesNotExist:
        return Response({'error': 'Integration not found'}, status=status.HTTP_404_NOT_FOUND)

    if not integration.is_connected:
        return Response({'success': False, 'message': 'Integration is not connected'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Parse target date from request (default: today)
    date_str = request.data.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)
    else:
        target_date = date.today()

    if service == 'GOMENU':
        try:
            from integrations.gomenu import sync_daily_sales
            result = sync_daily_sales(integration, target_date)
            return Response(result)
        except Exception as e:
            logger.exception('GoMenu sync error')
            return Response({
                'success': False,
                'error': f'Sync error: {str(e)}',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({
        'success': False,
        'error': f'Sync not implemented for {service}',
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsManager])
def integration_store_select(request, service):
    """Save selected store_id for an integration"""
    org = request.user.profile.organization
    service = service.upper()

    try:
        integration = Integration.objects.get(organization=org, service=service)
    except Integration.DoesNotExist:
        return Response({'error': 'Integration not found'}, status=status.HTTP_404_NOT_FOUND)

    store_id = request.data.get('store_id')
    if not store_id:
        return Response({'error': 'store_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    config = integration.config or {}
    config['store_id'] = str(store_id)
    integration.config = config
    integration.save()

    return Response({
        'success': True,
        'message': f'Store {store_id} selected',
        'config': integration.config,
    })


# ──────────────────────────────────────────────
#  Store Application (신규 스토어 오픈 신청)
# ──────────────────────────────────────────────

class StoreApplicationPublicView(APIView):
    """Public endpoint for submitting store opening applications"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = StoreApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'message': 'Application submitted successfully',
            'application': serializer.data,
        }, status=status.HTTP_201_CREATED)


class StoreApplicationAdminViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin endpoints for managing store applications (CEO/HQ only)"""
    serializer_class = StoreApplicationSerializer
    permission_classes = [IsAuthenticated, IsManager]
    pagination_class = None

    def get_queryset(self):
        qs = StoreApplication.objects.all()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve store application → create Organization + Manager account"""
        from hr.utils import generate_temp_password, generate_username_from_email

        application = self.get_object()
        if application.status != 'PENDING':
            return Response({'error': 'Only pending applications can be approved'},
                            status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=application.applicant_email).exists():
            return Response({'error': 'A user with this email already exists'},
                            status=status.HTTP_400_BAD_REQUEST)

        temp_password = generate_temp_password()
        username = generate_username_from_email(application.applicant_email)

        # Find parent HQ org
        hq_org = Organization.objects.filter(level='HQ').first()

        with transaction.atomic():
            # 1. Create Organization (STORE level)
            org = Organization.objects.create(
                name=application.store_name,
                level='STORE',
                parent=hq_org,
                address=application.store_address,
                phone=application.store_phone,
                email=application.applicant_email,
                enabled_modules=application.desired_modules,
            )

            # 2. Create User
            name_parts = application.applicant_name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''

            user = User.objects.create_user(
                username=username,
                password=temp_password,
                email=application.applicant_email,
                first_name=first_name,
                last_name=last_name,
            )

            # 3. Create UserProfile as MANAGER
            employee_id = f"EMP-{org.id}-{user.id}"
            UserProfile.objects.create(
                user=user,
                employee_id=employee_id,
                role='MANAGER',
                organization=org,
                date_of_joining=timezone.now().date(),
                phone=application.applicant_phone or '',
            )

            # 4. Update application status
            application.status = 'APPROVED'
            application.admin_notes = request.data.get('admin_notes', '')
            application.reviewed_by = request.user.profile
            application.reviewed_at = timezone.now()
            application.save()

        return Response({
            'message': 'Application approved. Store and manager account created.',
            'application': StoreApplicationSerializer(application).data,
            'organization_id': org.id,
            'generated_credentials': {
                'email': application.applicant_email,
                'password': temp_password,
            },
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject store application"""
        application = self.get_object()
        if application.status != 'PENDING':
            return Response({'error': 'Only pending applications can be rejected'},
                            status=status.HTTP_400_BAD_REQUEST)

        application.status = 'REJECTED'
        application.admin_notes = request.data.get('admin_notes', '')
        application.reviewed_by = request.user.profile
        application.reviewed_at = timezone.now()
        application.save()

        return Response(StoreApplicationSerializer(application).data)


class JobTitleViewSet(viewsets.ModelViewSet):
    """CRUD for dynamic job titles per organization"""
    queryset = JobTitle.objects.all()
    serializer_class = JobTitleSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [OrganizationFilterBackend]
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(organization=get_target_org(self.request))
