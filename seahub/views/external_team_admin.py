# -*- coding: utf-8 -*-
import time
import logging

import jwt
from django.http import HttpResponseRedirect

from seahub.auth.decorators import login_required
from seahub.utils import render_error
from seahub.settings import USE_EXTERNAL_TEAM_ADMIN, EXTERNAL_TEAM_ADMIN_SECRET_KEY, EXTERNAL_TEAM_ADMIN_URL
from seahub.api2.models import Token


logger = logging.getLogger(__name__)


@login_required
def external_team_admin(request):
    if not USE_EXTERNAL_TEAM_ADMIN or not EXTERNAL_TEAM_ADMIN_SECRET_KEY or not EXTERNAL_TEAM_ADMIN_URL:
        return render_error(request, 'Feature is not enabled.')

    username = request.user.username
    try:
        api_token, _ = Token.objects.get_or_create(user=username)
    except Exception as e:
        logger.error(e)
        return render_error(request, 'Internal Server Error')

    payload = {
        'exp': int(time.time()) + 100,
        'user_id': username,
        'api_token': api_token.key,
    }

    try:
        access_token = jwt.encode(payload, EXTERNAL_TEAM_ADMIN_SECRET_KEY, algorithm='HS256')
    except Exception as e:
        logger.error(e)
        return render_error(request, 'Internal Server Error')

    redirect_to = EXTERNAL_TEAM_ADMIN_URL.strip('/') + '/?token=%s' % access_token
    return HttpResponseRedirect(redirect_to)
