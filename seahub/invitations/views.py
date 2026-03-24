# Copyright (c) 2012-2016 Seafile Ltd.
from django.conf import settings
from django.urls import reverse
from django.http import HttpResponseRedirect, Http404
from django.shortcuts import get_object_or_404, render
from django.utils.translation import gettext as _
from seahub.invitations.models import InvitationLinks

def invitation_link_view(request, token):

    if not settings.ENABLE_SIGNUP:
        raise Http404

    get_object_or_404(InvitationLinks, token=token)

    if request.user.is_authenticated:
        return HttpResponseRedirect(reverse('projects_list'))

    response = HttpResponseRedirect('https://www.seatable.cn/?source=invitation&invitation_token=%s' % token)

    return response
