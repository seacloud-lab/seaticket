# Copyright (c) 2012-2016 Seafile Ltd.
from django.conf import settings
from django.contrib import messages
from django.urls import reverse
from django.http import HttpResponseRedirect, Http404
from django.shortcuts import get_object_or_404, render
from django.utils.translation import gettext as _
from seahub.auth import login as auth_login, authenticate
from seahub.auth import get_backends
from seahub.base.accounts import User
from seahub.constants import GUEST_USER
from seahub.invitations.models import Invitation, InvitationLinks
from seahub.invitations.signals import accept_guest_invitation_successful
from seahub.settings import SITE_ROOT, NOTIFY_ADMIN_AFTER_REGISTRATION
from seahub.registration.models import notify_admins_on_register_complete
from seahub.utils import render_error
from seahub.utils.licenseparse import user_number_over_limit


def invitation_link_view(request, token):

    if not settings.ENABLE_SIGNUP:
        raise Http404

    get_object_or_404(InvitationLinks, token=token)

    if request.user.is_authenticated:
        return HttpResponseRedirect(reverse('projects_list'))

    response = HttpResponseRedirect('https://www.seatable.cn/?source=invitation&invitation_token=%s' % token)

    return response

