# Copyright (c) 2012-2016 Seafile Ltd.
import json
import logging

from django.conf import settings
from django.urls import reverse
from django.contrib import messages
from django.http import HttpResponseRedirect, Http404, HttpResponse
from django.shortcuts import render, redirect
from django.template.loader import render_to_string
from django.utils.translation import gettext as _

from seahub.auth.decorators import login_required, login_required_ajax
from seahub.notifications.models import Notification, NotificationForm, \
    UserNotification
from seahub.notifications.utils import refresh_cache
from seahub.avatar.util import get_default_avatar_url

# Get an instance of a logger
from seahub.settings import SITE_ROOT

logger = logging.getLogger(__name__)


@login_required
def notification_add(request):
    if not request.user.is_staff or request.method != 'POST':
        raise Http404

    f = NotificationForm(request.POST)
    f.save()
    return HttpResponseRedirect(reverse('notification_list', args=[]))

@login_required
def notification_delete(request, nid):
    if not request.user.is_staff:
        raise Http404
    Notification.objects.filter(id=nid).delete()
    refresh_cache()

    return HttpResponseRedirect(reverse('notification_list', args=[]))

@login_required
def set_primary(request, nid):
    if not request.user.is_staff:
        raise Http404

    # TODO: use transaction?
    Notification.objects.filter(primary=1).update(primary=0)
    Notification.objects.filter(id=nid).update(primary=1)

    refresh_cache()

    return HttpResponseRedirect(reverse('notification_list', args=[]))

########## user notifications
@login_required
def user_notification_list(request):

    return redirect(SITE_ROOT + '?notifications=all' )

@login_required_ajax
def user_notification_more(request):
    """Fetch next ``limit`` notifications starts from ``start``.

    Arguments:
    - `request`:
    - `start`:
    - `limit`:
    """
    username = request.user.username
    start = int(request.GET.get('start', 0))
    limit = int(request.GET.get('limit', 0))

    notices = UserNotification.objects.get_user_notifications(username)[
        start: start+limit]

    # Add 'msg_from' or 'default_avatar_url' to notice.
    notices = add_notice_from_info(notices)

    notices_more = True if len(notices) == limit else False
    new_start = start+limit

    ctx = {'notices': notices}
    html = render_to_string("notifications/user_notification_tr.html", ctx)

    ct = 'application/json; charset=utf-8'
    return HttpResponse(json.dumps({
                'html':html,
                'notices_more':notices_more,
                'new_start': new_start}), content_type=ct)

@login_required
def user_notification_remove(request):
    """

    Arguments:
    - `request`:
    """
    UserNotification.objects.remove_user_notifications(request.user.username)

    messages.success(request, _("Successfully cleared all notices."))
    next_page = request.META.get('HTTP_REFERER', None)
    if not next_page:
        next_page = settings.SITE_ROOT
    return HttpResponseRedirect(next_page)

def add_notice_from_info(notices):
    '''Add 'msg_from' or 'default_avatar_url' to notice.

    '''
    default_avatar_url = get_default_avatar_url()
    for notice in notices:
        notice.default_avatar_url = default_avatar_url

        if notice.is_add_user_to_group_msg():
            try:
                d = json.loads(notice.detail)
                notice.msg_from = d['group_staff']
            except Exception as e:
                logger.error(e)

        if notice.is_share_dtable_to_user_msg():
            try:
                d = json.loads(notice.detail)
                notice.msg_from = d['share_user']
            except Exception as e:
                logger.error(e)

    return notices
