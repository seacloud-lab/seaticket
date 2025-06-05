# Copyright (c) 2012-2019 Seafile Ltd.
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.utils.translation import gettext as _
from seaserv import ccnet_api, seafile_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.endpoints.org_admin.dtables import _check_org
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, DTableExternalLinks, DTableViewExternalLinks
from seahub.organizations.permissions import IsOrgAdmin

from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.utils import gen_dtable_external_link
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.constants import PERMISSION_READ_WRITE


logger = logging.getLogger(__name__)


def _get_external_link_info(dtable_external_link):
    return {
        'id': dtable_external_link.id,
        'url': gen_dtable_external_link(dtable_external_link.token, dtable_external_link.is_custom),
        'token': dtable_external_link.token,
        'permission': 'read-write' if dtable_external_link.permission == PERMISSION_READ_WRITE else 'read-only',
        'creator_name': email2nickname(dtable_external_link.creator),
        'creator': dtable_external_link.creator,
        'view_cnt': dtable_external_link.view_cnt,
        'create_at': datetime_to_isoformat_timestr(dtable_external_link.create_at),
        'from_dtable': dtable_external_link.dtable.name,
        'expire_date': datetime_to_isoformat_timestr(dtable_external_link.expire_date),
        'is_protected': dtable_external_link.is_encrypted(),
        'from_base_uuid': str(dtable_external_link.dtable.uuid),
    }


class OrgAdminExternalLinks(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdmin,)

    def get(self, request, org_id):
        """ List 'all' ExternalLinks

            Permission checking:
            1. only admin can perform this action.
        """
        # permission check
        error, _ = _check_org(org_id)
        if error:
            return error

        org_id = int(org_id)
        user_org_id = request.user.org.org_id
        if not org_id == user_org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        # list dtables by page
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 1
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

        try:
            external_links_queryset = DTableExternalLinks.objects.get_dtable_external_links_by_org_id(org_id).select_related('dtable')
            external_links_count = external_links_queryset.count()

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        external_link_list = [_get_external_link_info(link) for link in external_links_queryset[start: end]]

        res = {
            'external_link_list': external_link_list,
            'count': external_links_count
        }

        return Response(res)


class OrgAdminExternalLink(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdmin,)


    def delete(self, request, org_id, token):
        """ delete a external link by token

            Permission checking:
            1. only org admin can perform this action.
        """
        # permission check

        error, _ = _check_org(org_id)
        if error:
            return error

        org_id = int(org_id)
        user_org_id = request.user.org.org_id
        if not org_id == user_org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        link = DTableExternalLinks.objects.get_dtable_external_link_by_org_and_token(org_id, token)
        if not link:
            return Response({'success': True})

        try:
            link.delete()
        except DTableExternalLinks.DoesNotExist:
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class OrgAdminViewExternalLinks(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdmin,)

    def get(self, request, org_id):
        """ List 'all' ExternalLinks

            Permission checking:
            1. only admin can perform this action.
        """
        # permission check
        error, _ = _check_org(org_id)
        if error:
            return error

        org_id = int(org_id)
        user_org_id = request.user.org.org_id
        if not org_id == user_org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)


        # list dtables by page
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 1
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

        try:
            external_links_queryset = DTableViewExternalLinks.objects.get_view_external_links_by_org_id(org_id).select_related('dtable')
            external_links_count = external_links_queryset.count()

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        external_link_list = []
        for link in external_links_queryset[start:end]:
            link_info = link.to_dict()
            link_info['from_base_uuid'] = str(link.dtable.uuid)
            external_link_list.append(link_info)

        res = {
            'external_link_list': external_link_list,
            'count': external_links_count
        }

        return Response(res)


class OrgAdminViewExternalLink(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdmin,)


    def delete(self, request, org_id, token):
        """ delete a external link by token

            Permission checking:
            1. only org admin can perform this action.
        """
        # permission check
        error, _ = _check_org(org_id)
        if error:
            return error

        org_id = int(org_id)
        user_org_id = request.user.org.org_id
        if not org_id == user_org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        link = DTableViewExternalLinks.objects.get_view_external_link_by_org_and_token(org_id, token)
        if not link:
            return Response({'success': True})

        try:
            link.delete()
        except DTableViewExternalLinks.DoesNotExist:
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})
