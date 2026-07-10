import logging
import requests
from django.conf import settings

from seahub.api2.utils import get_client_ip

logger = logging.getLogger(__name__)

TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

def check_turnstile(request):
    """
    Verify Cloudflare Turnstile token.
    Returns:
        (bool) True if verification is successful or turnstile is disabled, False otherwise.
    """
    if not settings.ENABLE_TURNSTILE:
        return True

    turnstile_token = request.POST.get('cf-turnstile-response', '')
    if not turnstile_token:
        logger.warning('Cloudflare Turnstile check failed: Missing token')
        return False

    secret = settings.TURNSTILE_SECRET_KEY
    if not secret:
        logger.error('Cloudflare Turnstile check failed: TURNSTILE_SECRET_KEY is not configured')
        return False

    remoteip = get_client_ip(request)
    data = {'secret': secret, 'response': turnstile_token}
    if remoteip:
        data['remoteip'] = remoteip

    try:
        response = requests.post(TURNSTILE_SITEVERIFY_URL, data=data, timeout=10)
        result = response.json()
    except (requests.RequestException, ValueError) as e:
        logger.error(f"Turnstile verification error: {e}")
        return False

    if not result.get('success'):
        logger.error(f"Turnstile verification failed: {result}")
        return False
    return True
