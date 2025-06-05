# Copyright (c) 2012-2019 Seafile Ltd.
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from django.utils.translation import gettext as _
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, DTableShareLinks, Workspaces
from seahub.organizations.permissions import IsOrgAdmin
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_PREFIX
from seahub.settings import SHARE_LINK_EXPIRE_DAYS_MAX, SHARE_LINK_EXPIRE_DAYS_MIN, SHARE_LINK_EXPIRE_DAYS_DEFAULT, \
    SHARE_LINK_PASSWORD_MIN_LENGTH
from seahub.dtable.utils import gen_share_dtable_link, get_share_permission
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seaserv import seafile_api
from dateutil.relativedelta import relativedelta
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from seahub.organizations.utils import check_org_admin


logger = logging.getLogger(__name__)
permission_tuple = (PERMISSION_READ, PERMISSION_READ_WRITE)


def get_share_dtable_link_info(sdl, dtable):
    data = {
        'username': sdl.username,
        'permission': sdl.permission,
        'token': sdl.token,
        'link': gen_share_dtable_link(sdl.token),
        'dtable_name': dtable.name,
        'dtable_id': dtable.id,
        'workspace_id': dtable.workspace_id,
        'expire_date': datetime_to_isoformat_timestr(sdl.expire_date),
        'ctime': datetime_to_isoformat_timestr(sdl.ctime),
        'is_protected': sdl.is_encrypted(),
    }

    return data


class OrgAdminInviteLinks(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdmin,)

    @check_org_admin
    def get(self, request, org_id):
        """ List Invite Links

        """
        org_id = int(org_id)
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 1
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

        try:
            invite_link_queryset = DTableShareLinks.objects.filter(dtable__deleted=False, dtable__workspace__org_id=org_id)
            invite_links_count = invite_link_queryset.count()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        invite_link_list = []
        invite_links = invite_link_queryset[start:end]
        for link in invite_links:
            link_dict = {
                'dtable_name': link.dtable.name,
                'username': link.username,
                'token': link.token,
                'ctime': datetime_to_isoformat_timestr(link.ctime),
                'expire_date': datetime_to_isoformat_timestr(link.expire_date),
                'permission': link.permission,
                'workspace_id': link.dtable.workspace_id,
                'is_protected': link.is_encrypted(),
            }
            invite_link_list.append(link_dict)

        res = {
            'invite_link_list': invite_link_list,
            'count': invite_links_count
        }

        return Response(res)


class OrgAdminInviteLink(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdmin,)

    @check_org_admin
    def delete(self, request, org_id, token):
        """ delete a invite link by token
        """
        org_id = int(org_id)
        link = DTableShareLinks.objects.filter(token=token, dtable__workspace__org_id=org_id)
        if not link:
            return Response({'success': True})

        try:
            link.delete()
        except DTableShareLinks.DoesNotExist:
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    @check_org_admin
    def put(self, request, org_id, token):
        org_id = int(org_id)
        link_permission = request.data.get('permission')
        if not link_permission or (
                link_permission not in permission_tuple and
                PERMISSION_PREFIX not in link_permission):
            error_msg = 'Permission invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        password = request.data.get('password')
        if password and len(password) < SHARE_LINK_PASSWORD_MIN_LENGTH:
            error_msg = 'Password is too short.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if password:
            password = make_password(password)

        expire_days = request.data.get('expire_days')
        if expire_days:
            try:
                expire_days = int(expire_days)
            except:
                error_msg = 'expire_days is invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if expire_days <= 0:
                if SHARE_LINK_EXPIRE_DAYS_DEFAULT > 0:
                    expire_days = SHARE_LINK_EXPIRE_DAYS_DEFAULT

            if SHARE_LINK_EXPIRE_DAYS_MIN > 0:
                if expire_days < SHARE_LINK_EXPIRE_DAYS_MIN:
                    error_msg = _('Expire days should be greater or equal to %s') % \
                                SHARE_LINK_EXPIRE_DAYS_MIN
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if SHARE_LINK_EXPIRE_DAYS_MAX > 0:
                if expire_days > SHARE_LINK_EXPIRE_DAYS_MAX:
                    error_msg = _('Expire days should be less than or equal to %s') % \
                                SHARE_LINK_EXPIRE_DAYS_MAX
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if expire_days <= 0:
                expire_date = None
            else:
                try:
                    expire_date = timezone.now() + relativedelta(days=expire_days)
                except:
                    error_msg = 'expire_days is invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        else:
            expire_date = None

        try:
            shareLinkQuerySet = DTableShareLinks.objects.filter(token=token, dtable__workspace__org_id=org_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # share permission check
        if not shareLinkQuerySet.exists():
            error_msg = 'Share link %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        shareLink = shareLinkQuerySet.first()
        if link_permission not in permission_tuple:
            share_permission = get_share_permission(link_permission, shareLink.dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        try:
            shareLinkQuerySet.update(permission=link_permission, expire_date=expire_date, password=password)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        data = get_share_dtable_link_info(shareLink, shareLink.dtable) if shareLink else {}

        return Response(data)
