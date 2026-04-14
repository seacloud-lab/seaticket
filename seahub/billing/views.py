import jwt
import time
import uuid
import json
import logging
from urllib.parse import urlparse

from django.conf import settings
from django.http import HttpResponse

from seahub.utils import render_error, get_service_url
from seahub.profile.models import Profile
from seahub.auth.decorators import login_required
from seahub.organizations.decorators import org_staff_required
from seahub.base.templatetags.seahub_tags import email2contact_email

from seahub.billing.redis_client import get_redis_conn
from seahub.billing.settings import ENABLE_EXTERNAL_BILLING_SERVICE, \
        BILLING_SERVICE_URL, BILLING_SERVICE_JWT_AUTH_URL, \
        BILLING_SERVICE_JWT_SECRET_KEY, BILLING_SERVICE_JWT_ALGORITHM, \
        BILLING_SERVICE_JWT_EXPIRATION


logger = logging.getLogger(__name__)


@login_required
@org_staff_required
def billing(request):

    if not ENABLE_EXTERNAL_BILLING_SERVICE:
        return render_error(request, 'Billing is not enabled.')

    user_id = request.user.username
    profile = Profile.objects.get_profile_by_user(user_id)
    contact_email = profile.contact_email if profile and profile.contact_email else ''
    nickname = profile.nickname if profile and profile.nickname else ''

    seafile_parsed_url = urlparse(get_service_url())
    seafile_domain = seafile_parsed_url.netloc.split(':')[0]

    billing_parsed_url = urlparse(BILLING_SERVICE_URL)
    billing_domain = billing_parsed_url.netloc.split(':')[0]

    now = int(time.time())
    exp = now + BILLING_SERVICE_JWT_EXPIRATION

    org = request.user.org

    payload = {
        "iss": seafile_domain,
        "aud": billing_domain,
        "exp": exp,
        "jti": str(uuid.uuid4()),
        "user_id": user_id,
        "email": contact_email,
        "name": nickname,
        "org_id": org.org_id,
        "org_name": org.org_name
    }
    token = jwt.encode(payload, BILLING_SERVICE_JWT_SECRET_KEY,
                       algorithm=BILLING_SERVICE_JWT_ALGORITHM)

    html = f'''
    <html>
        <body>
            <form id="postForm" action="{BILLING_SERVICE_JWT_AUTH_URL}" method="post">
                <input type="hidden" name="token" value="{token}">
            </form>
            <script>
                document.getElementById('postForm').submit();
            </script>
        </body>
    </html>
    '''
    response = HttpResponse(html)
    response['Content-Type'] = 'text/html'
    return response


def org_operation_callback(sender, **kwargs):

    # org obj
    # {
    #     'creator': '81f5490aa5ba4ce992e2bf7ad94ac914@auth.local',
    #     'ctime': 1746692699034884,
    #     'email': None,
    #     'is_staff': 0,
    #     'org_id': 21,
    #     'org_name': 'lian-test-org-2',
    #     'url_prefix': 'org-lzv168',
    # }

    org = kwargs.get('org')
    operation = kwargs.get('operation')  # create, delete

    payload = {
        'org_id': org.org_id,
        'org_ctime': org.ctime,
        'org_name': org.org_name,
        'org_creator_ccnet_email': org.creator,
        'org_creator_contact_email': email2contact_email(org.creator),
        'operation': operation,
    }

    json_data = json.dumps(payload)
    redis_conn = get_redis_conn()
    channel = settings.BILLING_REDIS_CONFIG["channel"]
    redis_conn.publish(channel, json_data)
    logger.info(json_data)
