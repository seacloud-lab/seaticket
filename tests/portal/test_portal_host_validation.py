import logging
from unittest.mock import patch

import pytest
from django.http import HttpResponse
from django.middleware.common import CommonMiddleware
from django.test import Client, RequestFactory, override_settings
from django.urls import path

from seahub.portal.host_middleware import PortalHostValidationMiddleware


def host_validation_view(request):
    return HttpResponse('ok')


def failing_view(request):
    raise RuntimeError('Backend failure')


urlpatterns = [path('', host_validation_view), path('fail/', failing_view)]


@pytest.mark.parametrize('host', [
    '_mta-sts.seaticket-portal.ai',
    '*.example.com',
    'foo..example.com',
    'example.com..',
    '-foo.example.com',
    'foo-.example.com',
    'a' * 64 + '.example.com',
    '.'.join(['a' * 63] * 4),
    '[:::]',
    '[a:b]',
])
@override_settings(ALLOWED_HOSTS=['*'])
def test_invalid_host_returns_400_without_reaching_common_middleware(host, caplog):
    request = RequestFactory().get('/', HTTP_HOST=host)

    def unexpected_request(_request):
        pytest.fail('Invalid Host reached downstream middleware.')

    middleware = PortalHostValidationMiddleware(CommonMiddleware(unexpected_request))
    with caplog.at_level(logging.WARNING):
        response = middleware(request)

    assert response.status_code == 400
    assert response.content == b'Invalid Host.'
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.name == 'seahub.portal.host_middleware'
    assert record.levelno == logging.WARNING
    assert record.exc_info is None
    assert record.status_code == 400
    assert 'host=%r' % host in record.getMessage()
    assert "peer='127.0.0.1'" in record.getMessage()


@pytest.mark.parametrize('host', [
    'support.example.com',
    'EXAMPLE.COM',
    'support.example.com.:443',
    'xn--fiqs8s.example.com',
    'a' * 63 + '.example.com',
    '127.0.0.1',
    '127.0.0.1:80',
    '[::1]',
    '[2001:db8::1]:443',
    'seaticket-portal',
])
@override_settings(ALLOWED_HOSTS=['*'])
def test_valid_public_and_internal_hosts_pass_through(host):
    request = RequestFactory().get('/i18n/', HTTP_HOST=host)
    response = PortalHostValidationMiddleware(lambda _request: HttpResponse('ok'))(request)

    assert response.status_code == 200
    assert response.content == b'ok'


@override_settings(ALLOWED_HOSTS=['allowed.example.com'])
def test_host_validation_preserves_allowed_hosts_restriction():
    request = RequestFactory().get('/', HTTP_HOST='other.example.com')
    response = PortalHostValidationMiddleware(lambda _request: HttpResponse('ok'))(request)

    assert response.status_code == 400


@override_settings(ALLOWED_HOSTS=['*'], USE_X_FORWARDED_HOST=True)
def test_invalid_forwarded_host_is_included_in_rejection_log(caplog):
    request = RequestFactory().get(
        '/', HTTP_HOST='seaticket-portal', HTTP_X_FORWARDED_HOST='_mta-sts.example.com',
    )

    with caplog.at_level(logging.WARNING):
        response = PortalHostValidationMiddleware(lambda _request: HttpResponse('ok'))(request)

    assert response.status_code == 400
    assert len(caplog.records) == 1
    assert "forwarded_host='_mta-sts.example.com'" in caplog.records[0].getMessage()


@override_settings(ALLOWED_HOSTS=['*'], USE_X_FORWARDED_HOST=False)
def test_untrusted_forwarded_host_does_not_override_host():
    request = RequestFactory().get(
        '/', HTTP_HOST='support.example.com', HTTP_X_FORWARDED_HOST='_mta-sts.example.com',
    )
    response = PortalHostValidationMiddleware(lambda _request: HttpResponse('ok'))(request)

    assert response.status_code == 200


@override_settings(
    ALLOWED_HOSTS=['*'],
    ROOT_URLCONF=__name__,
    MIDDLEWARE=[
        'seahub.portal.host_middleware.PortalHostValidationMiddleware',
        'django.middleware.common.CommonMiddleware',
    ],
)
def test_invalid_host_logs_only_once_in_django_handler(caplog):
    with caplog.at_level(logging.WARNING), patch.object(logging.getLogger('django.request'), 'warning') as request_warning:
        response = Client().get('/', HTTP_HOST='_mta-sts.example.com')

    assert response.status_code == 400
    assert len(caplog.records) == 1
    assert caplog.records[0].levelno == logging.WARNING
    request_warning.assert_not_called()


@override_settings(
    ALLOWED_HOSTS=['*'],
    ROOT_URLCONF=__name__,
    MIDDLEWARE=['seahub.portal.host_middleware.PortalHostValidationMiddleware'],
    DEBUG=False,
    DEBUG_PROPAGATE_EXCEPTIONS=False,
)
def test_unexpected_downstream_errors_remain_500_and_error_logs():
    with patch.object(logging.getLogger('django.request'), 'error') as request_error:
        response = Client(raise_request_exception=False).get('/fail/', HTTP_HOST='support.example.com')

    assert response.status_code == 500
    request_error.assert_called_once()
    assert isinstance(request_error.call_args.kwargs['exc_info'], RuntimeError)
