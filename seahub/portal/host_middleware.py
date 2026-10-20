import logging
from urllib.parse import urlsplit

from django.core.exceptions import DisallowedHost
from django.http import HttpResponseBadRequest
from django.utils.deprecation import MiddlewareMixin
from django.utils.log import log_response

from seahub.portal.custom_domain import HOST_LABEL_RE


logger = logging.getLogger(__name__)


class PortalHostValidationMiddleware(MiddlewareMixin):

    def process_request(self, request):
        try:
            host = request.get_host()
            hostname = (urlsplit('//%s' % host).hostname or '').removesuffix('.')
            # IP addresses and single-label Docker service names are used by
            # internal health checks and the TLS authorization endpoint.
            if not hostname or (':' not in hostname and (
                len(hostname) > 253 or any(not HOST_LABEL_RE.fullmatch(label) for label in hostname.split('.'))
            )):
                raise ValueError('Invalid hostname.')
        except (DisallowedHost, ValueError):
            response = HttpResponseBadRequest('Invalid Host.')
            log_response(
                'Rejected invalid portal Host: host=%r forwarded_host=%r path=%r peer=%r',
                request.META.get('HTTP_HOST', ''),
                request.META.get('HTTP_X_FORWARDED_HOST', ''),
                request.path_info,
                request.META.get('REMOTE_ADDR', ''),
                response=response,
                request=request,
                logger=logger,
            )
            return response

        return None
