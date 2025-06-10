# Copyright (c) 2012-2016 Seafile Ltd.
import re
import logging

from django.conf import settings

from seahub.invitations.models import InvitationLinks, RegistrationLogs


def record_registration_logs(user, source='', token=''):
    source = str(source) if source else 'default'
    if source == 'invitation' and token:
        invitation_link = InvitationLinks.objects.get_invitation_link_by_token(token)
        if not invitation_link:
            logging.error('invitation_link %s not found' % token)
            return
        try:
            RegistrationLogs.objects.create(accepter=user.username, source=source, token=token)
        except Exception as e:
            logging.error(e)
    else:
        try:
            RegistrationLogs.objects.create(accepter=user.username, source=source)
        except Exception as e:
            logging.error(e)


def record_org_registration_logs(org, source=''):
    source = str(source) if source else 'default'
    logging.info('Org %s registration from %s source' % (org.org_id, source))


def block_accepter(accepter):
    for pattern in settings.INVITATION_ACCEPTER_BLACKLIST:
        if pattern.startswith('*'):
            if accepter.endswith(pattern[1:]):
                return True
        elif accepter == pattern:
            return True
        else:
            compiled_pattern = re.compile(pattern)
            if compiled_pattern.search(accepter) is not None:
                return True

    return False
