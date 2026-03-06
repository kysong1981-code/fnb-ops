"""
Health check views for fnb-ops application
Used by load balancers and orchestration systems for service health monitoring
"""
from django.http import JsonResponse
from django.db import connection
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json


@csrf_exempt
@require_http_methods(["GET"])
def health_check(request):
    """
    Basic health check endpoint
    Returns 200 OK if service is running
    """
    try:
        return JsonResponse(
            {
                'status': 'healthy',
                'service': 'fnb-ops-backend',
            },
            status=200
        )
    except Exception as e:
        return JsonResponse(
            {
                'status': 'unhealthy',
                'error': str(e),
            },
            status=500
        )


@csrf_exempt
@require_http_methods(["GET"])
def readiness_check(request):
    """
    Readiness check endpoint - verifies database connectivity
    Used by Kubernetes readiness probes
    Returns 200 OK only if database is accessible
    """
    try:
        # Check database connectivity
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")

        return JsonResponse(
            {
                'status': 'ready',
                'service': 'fnb-ops-backend',
                'database': 'connected',
            },
            status=200
        )
    except Exception as e:
        return JsonResponse(
            {
                'status': 'not_ready',
                'error': str(e),
            },
            status=503
        )


@csrf_exempt
@require_http_methods(["GET"])
def liveness_check(request):
    """
    Liveness check endpoint - verifies service is responsive
    Used by Kubernetes liveness probes
    Returns 200 OK if service is alive (even if degraded)
    """
    try:
        return JsonResponse(
            {
                'status': 'alive',
                'service': 'fnb-ops-backend',
            },
            status=200
        )
    except Exception as e:
        return JsonResponse(
            {
                'status': 'dead',
                'error': str(e),
            },
            status=500
        )
