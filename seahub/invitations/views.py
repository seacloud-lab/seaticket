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


def token_view(request, token):
    """Show form to let user set password.
    """
    i = get_object_or_404(Invitation, token=token)
    if i.is_expired():
        raise Http404

    if request.method == 'GET':
        try:
            user = User.objects.get(email=i.accepter)
            if user.is_active is True:
                # user is active return exist
                messages.error(request, _('A user with this email already exists.'))
        except User.DoesNotExist:
            pass

        return render(request, 'invitations/token_view.html', {'iv': i, })

    if request.method == 'POST':
        passwd = request.POST.get('password', '')
        if not passwd:
            return HttpResponseRedirect(request.META.get('HTTP_REFERER'))

        try:
            user = User.objects.get(email=i.accepter)
            if user.is_active is True:
                # user is active return exist
                messages.error(request, _('A user with this email already exists.'))
                return render(request, 'invitations/token_view.html', {'iv': i, })
            else:
                # user is inactive then set active and new password
                user.set_password(passwd)
                user.is_active = True
                user.save()
                user = authenticate(username=user.username, password=passwd)

        except User.DoesNotExist:
            if user_number_over_limit():
                error_msg = _("The number of users exceeds the limit.")
                return render_error(request, error_msg)

            # Create user, set that user as guest.
            user = User.objects.create_user(
                email=i.accepter, password=passwd, is_active=True)
            User.objects.update_role(user.username, GUEST_USER)
            for backend in get_backends():
                user.backend = "%s.%s" % (backend.__module__, backend.__class__.__name__)

        # Update invitation accept time.
        i.accept()

        # login
        auth_login(request, user)

        # send signal to notify inviter
        accept_guest_invitation_successful.send(
            sender=None, invitation_obj=i)

        # send email to notify admin
        if NOTIFY_ADMIN_AFTER_REGISTRATION:
            notify_admins_on_register_complete(user.email)

        return HttpResponseRedirect(SITE_ROOT)


def invitation_link_view(request, token):

    if not settings.ENABLE_SIGNUP:
        raise Http404

    get_object_or_404(InvitationLinks, token=token)

    if request.user.is_authenticated:
        return HttpResponseRedirect(reverse('projects_list'))

    response = HttpResponseRedirect('https://www.seatable.cn/?source=invitation&invitation_token=%s' % token)

    return response

