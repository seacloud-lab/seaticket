# Copyright (c) 2012-2016 Seafile Ltd.
from django.conf import settings
from django.contrib import messages
from django.http import HttpResponseRedirect, Http404
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils.translation import gettext as _
from seahub.auth import authenticate, login as auth_login
from seahub.base.accounts import User
from seahub.invitations.models import Invitation, InvitationLinks
from seahub.invitations.signals import org_member_invite_accepted
from seahub.settings import SITE_ROOT
from seahub.organizations.models import Organization
from seahub.project.models import Workspaces
from seahub.utils import render_error

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
        passwd2 = request.POST.get('password2', '')
        if not passwd or not passwd2:
            return HttpResponseRedirect(request.META.get('HTTP_REFERER'))
        if passwd != passwd2:
            messages.error(request, _("Passwords don't match"))
            return render(request, 'invitations/token_view.html', {'iv': i, })

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
        org_member_invite_accepted.send(
            sender=None, invitation_obj=i)

        return HttpResponseRedirect(SITE_ROOT)

def invitation_link_view(request, token):

    if not settings.ENABLE_SIGNUP:
        raise Http404

    get_object_or_404(InvitationLinks, token=token)

    if request.user.is_authenticated:
        return HttpResponseRedirect(reverse('projects_list'))

    response = HttpResponseRedirect('https://www.seatable.cn/?source=invitation&invitation_token=%s' % token)

    return response
