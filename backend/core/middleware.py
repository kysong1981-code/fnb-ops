"""
Middleware for fnb-ops logging and monitoring
Includes request logging, error handling, and performance tracking
"""
import logging
import json
import time
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from rest_framework.request import Request

logger = logging.getLogger('django.request')


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log all HTTP requests and responses
    Logs are formatted as JSON for structured logging
    """

    def process_request(self, request):
        """Log incoming request"""
        # Store request start time for duration calculation
        request._request_start_time = time.time()

        # Skip logging for health checks and static files
        if request.path in ['/health/', '/ready/', '/alive/']:
            return None

        if request.path.startswith('/static/'):
            return None

        # Log request details
        log_data = {
            'event': 'request_received',
            'method': request.method,
            'path': request.path,
            'remote_addr': self._get_client_ip(request),
            'user': str(request.user) if request.user.is_authenticated else 'anonymous',
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
        }

        if request.method in ['POST', 'PUT', 'PATCH']:
            # Log POST/PUT data (be careful with sensitive data)
            try:
                if request.content_type == 'application/json':
                    log_data['body_preview'] = str(request.body[:200])
            except Exception:
                pass

        logger.info(json.dumps(log_data))
        return None

    def process_response(self, request, response):
        """Log response details"""
        # Skip logging for health checks and static files
        if request.path in ['/health/', '/ready/', '/alive/']:
            return response

        if request.path.startswith('/static/'):
            return response

        # Calculate request duration
        if hasattr(request, '_request_start_time'):
            duration = time.time() - request._request_start_time
        else:
            duration = 0

        # Log response details
        log_data = {
            'event': 'response_sent',
            'method': request.method,
            'path': request.path,
            'status_code': response.status_code,
            'duration_ms': round(duration * 1000, 2),
            'content_type': response.get('Content-Type', ''),
            'user': str(request.user) if request.user.is_authenticated else 'anonymous',
        }

        # Determine log level based on status code
        if response.status_code >= 500:
            logger.error(json.dumps(log_data))
        elif response.status_code >= 400:
            logger.warning(json.dumps(log_data))
        else:
            logger.info(json.dumps(log_data))

        return response

    def process_exception(self, request, exception):
        """Log exceptions"""
        log_data = {
            'event': 'exception_raised',
            'method': request.method,
            'path': request.path,
            'exception_type': type(exception).__name__,
            'exception_message': str(exception),
            'user': str(request.user) if request.user.is_authenticated else 'anonymous',
        }

        logger.exception(json.dumps(log_data))
        return None

    @staticmethod
    def _get_client_ip(request):
        """
        Get client IP address from request
        Handles proxies (X-Forwarded-For, X-Real-IP)
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class PerformanceMonitoringMiddleware(MiddlewareMixin):
    """
    Middleware to track slow requests
    Logs requests that take longer than threshold
    """
    SLOW_REQUEST_THRESHOLD = 1.0  # seconds

    def process_request(self, request):
        """Store request start time"""
        request._start_time = time.time()
        return None

    def process_response(self, request, response):
        """Check if request was slow"""
        if not hasattr(request, '_start_time'):
            return response

        # Skip health checks and static files
        if request.path in ['/health/', '/ready/', '/alive/']:
            return response

        if request.path.startswith('/static/'):
            return response

        duration = time.time() - request._start_time

        if duration > self.SLOW_REQUEST_THRESHOLD:
            log_data = {
                'event': 'slow_request',
                'method': request.method,
                'path': request.path,
                'duration_seconds': round(duration, 2),
                'status_code': response.status_code,
                'user': str(request.user) if request.user.is_authenticated else 'anonymous',
            }
            logger.warning(json.dumps(log_data))

        return response


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Middleware to add security headers to responses
    """

    def process_response(self, request, response):
        """Add security headers"""
        # X-Content-Type-Options: Prevent MIME type sniffing
        response['X-Content-Type-Options'] = 'nosniff'

        # X-Frame-Options: Prevent clickjacking
        response['X-Frame-Options'] = 'DENY'

        # X-XSS-Protection: Enable XSS protection
        response['X-XSS-Protection'] = '1; mode=block'

        # Referrer-Policy: Control referrer information
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Permissions-Policy: Control browser features
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

        return response
