# Copyright (c) 2012-2019 Seafile Ltd.
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.utils.translation import gettext as _
from django.db.models import Q

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable.models import DTableExternalLinks, DTableViewExternalLinks
from seahub.utils import get_inner_dtable_server_url

logger = logging.getLogger(__name__)


def get_dtable_external_links_info(links):
    external_link_list = []
    for link in links:
        link_info = link.to_dict()
        link_info['is_encrypted'] = link.is_encrypted()
        link_info['url'] = link.gen_dtable_external_link(link.token, is_custom=link.is_custom)
        link_info['from_base_uuid'] = str(link.dtable.uuid)
        external_link_list.append(link_info)
    return external_link_list


class AdminExternalLinks(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        """ List 'all' ExternalLinks

            Permission checking:
            1. only admin can perform this action.
        """
        # permission check
        if not request.user.admin_permissions.can_manage_external_link():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        org_id_str = request.GET.get('org_id')
        if org_id_str:
            try:
                org_id = int(org_id_str)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'org_id invalid')
        else:
            org_id = None

        # list dtables by page
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 1
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

        qs = []

        if org_id:
            qs.append(Q(dtable__workspace__org_id=org_id))

        try:
            external_links_count = DTableExternalLinks.objects.filter(*qs).count()
            external_links_queryset = list(DTableExternalLinks.objects.filter(*qs).order_by('-create_at').select_related('dtable')[start: end])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


        has_next_page = True if external_links_count > end else False
        external_link_list = get_dtable_external_links_info(external_links_queryset)

        res = {
            'has_next_page': has_next_page,
            'external_link_list': external_link_list,
        }

        return Response(res)



class AdminExternalLink(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def delete(self, request, token):
        """ delete a external link by token

            Permission checking:
            1. only admin can perform this action.
        """
        # permission check
        if not request.user.admin_permissions.can_manage_external_link():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            link = DTableExternalLinks.objects.get(token=token)
            link.delete()

        except DTableExternalLinks.DoesNotExist:
            return Response({'success': True})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class AdminSearchExternalLinksView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        query_str = request.GET.get('query')
        if not query_str:
            return api_error(status.HTTP_400_BAD_REQUEST, 'query invalid')

        # permission check
        if not request.user.admin_permissions.can_manage_external_link():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # query
        ## only token exact matching so far
        queryset = DTableExternalLinks.objects.filter(token=query_str)
        count = queryset.count()
        results = get_dtable_external_links_info(list(queryset))

        return Response({'count': count, 'external_link_list': results})


def get_view_external_links_info(links):
    external_link_list = []
    metadatas_dict = {}
    for link in links:
        link_info = link.to_dict()
        link_info['is_encrypted'] = link.is_encrypted()
        link_info['url'] = link.gen_dtable_external_link(link.token, is_custom=link.is_custom)
        link_info['from_base_uuid'] = str(link.dtable.uuid)
        if link_info['from_base_uuid'] not in metadatas_dict:
            dtable_server_api = DTableServerAPI('dtable-web', link_info['from_base_uuid'], get_inner_dtable_server_url())
            metadata = metadatas_dict[link_info['from_base_uuid']] = dtable_server_api.get_metadata()
        else:
            metadata = metadatas_dict[link_info['from_base_uuid']]
        table = next(filter(lambda table: table['_id'] == link.table_id, metadata['tables']), None)
        if not table:
            link_info['table_exists'] = False
        else:
            link_info['table_exists'] = True
            link_info['table_name'] = table.get('name')
            view = next(filter(lambda view: view['_id'] == link.view_id, table.get('views', [])), None)
            if not view:
                link_info['view_exists'] = False
            else:
                link_info['view_exists'] = True
                link_info['view_name'] = view.get('name')
        external_link_list.append(link_info)
    return external_link_list


class AdminViewExternalLinks(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        """ List 'all' ExternalLinks

            Permission checking:
            1. only admin can perform this action.
        """
        # permission check
        if not request.user.admin_permissions.can_manage_external_link():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        org_id_str = request.GET.get('org_id')
        if org_id_str:
            try:
                org_id = int(org_id_str)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'org_id invalid')
        else:
            org_id = None

        # list dtables by page
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 1
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

        qs = []

        if org_id:
            qs.append(Q(dtable__workspace__org_id=org_id))

        try:
            external_links_count = DTableViewExternalLinks.objects.filter(*qs).count()
            external_links_queryset = list(DTableViewExternalLinks.objects.filter(*qs).order_by('-create_at').select_related('dtable')[start: end])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        has_next_page = True if external_links_count > end else False
        external_link_list = get_view_external_links_info(external_links_queryset)

        res = {
            'has_next_page': has_next_page,
            'external_link_list': external_link_list,
        }

        return Response(res)



class AdminViewExternalLink(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def delete(self, request, token):
        """ delete a external link by token

            Permission checking:
            1. only admin can perform this action.
        """
        # permission check
        if not request.user.admin_permissions.can_manage_external_link():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            link = DTableViewExternalLinks.objects.get(token=token)
            link.delete()

        except DTableViewExternalLinks.DoesNotExist:
            return Response({'success': True})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class AdminSearchViewExternalLinksView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        query_str = request.GET.get('query')
        if not query_str:
            return api_error(status.HTTP_400_BAD_REQUEST, 'query invalid')

        # permission check
        if not request.user.admin_permissions.can_manage_external_link():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # query
        ## As for now, only support token exact matching
        queryset = DTableViewExternalLinks.objects.filter(token=query_str)
        count = queryset.count()
        results = get_view_external_links_info(list(queryset))

        return Response({'count': count, 'external_link_list': results})
