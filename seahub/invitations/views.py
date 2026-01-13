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
from seahub.organizations.models import Organization, OrgUser
from seahub.project.models import Workspaces


def token_view(request, token):
    """Show form to let user set password.
    """
    i = get_object_or_404(Invitation, token=token)
    if i.is_expired():
        return render_error(request, _('Invitation link is invalid or expired.'))

    if request.method == 'GET':
        from seahub.auth.utils import get_virtual_id_by_email
        vid = get_virtual_id_by_email(i.accepter)
        try:
            user = User.objects.get(email=vid)
            if user.is_active is True:
                messages.error(request, _('A user with this email already exists.'))
        except User.DoesNotExist:
            return render_error(request, _('Invitation link is invalid or expired.'))

        return render(request, 'invitations/token_view.html', {'iv': i, })

    if request.method == 'POST':
        passwd = request.POST.get('password', '')
        if not passwd:
            return HttpResponseRedirect(request.META.get('HTTP_REFERER'))

        from seahub.auth.utils import get_virtual_id_by_email
        vid = get_virtual_id_by_email(i.accepter)
        try:
            user = User.objects.get(email=vid)
            if user.is_active is True:
                messages.error(request, _('A user with this email already exists.'))
                return render(request, 'invitations/token_view.html', {'iv': i, })
            else:
                user.set_password(passwd)
                user.is_active = True
                user.save()
                user = authenticate(username=user.username, password=passwd)

        except User.DoesNotExist:
            return render_error(request, _('Invitation link is invalid or expired.'))

        # Update invitation accept time.
        i.accept()

        inviter_org = Organization.objects.get_org_by_username(i.inviter)
        if inviter_org:
            try:
                workspace = Workspaces.objects.get_workspace_by_owner(user.username)
                if workspace:
                    if workspace.org_id != inviter_org.org_id:
                        workspace.org_id = inviter_org.org_id
                        workspace.save(update_fields=['org_id'])
                else:
                    Workspaces.objects.create_workspace(user.username, inviter_org.org_id)
            except Exception:
                pass

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

