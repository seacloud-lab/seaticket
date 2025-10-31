# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import reverse
from django.http import Http404, HttpResponseRedirect, HttpResponseNotAllowed
from django.shortcuts import render

from urllib.parse import quote

from seahub.options.models import UserOptions, CryptoOptionNotSetError

from seahub.base.sudo_mode import sudo_mode_check
from seahub.utils import render_error
from django.utils.translation import gettext as _
from seahub.settings import ENABLE_SUDO_MODE

def sys_staff_required(func):
    """
    Decorator for views that checks the user is system staff.
    """
    def _decorated(request, *args, **kwargs):
        if not request.user.is_staff:
            raise Http404
        if ENABLE_SUDO_MODE and not sudo_mode_check(request):
            return HttpResponseRedirect(
                reverse('sys_sudo_mode') + '?next=' + quote(request.get_full_path()))
        return func(request, *args, **kwargs)
    return _decorated


def require_POST(func):
    def decorated(request, *args, **kwargs):
        if request.method != 'POST':
            return HttpResponseNotAllowed(['POST'])
        return func(request, *args, **kwargs)
    return decorated
