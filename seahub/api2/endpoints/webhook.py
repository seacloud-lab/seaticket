import json
import logging
import re

from django.db import transaction
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import Workspaces, DTables, Webhooks, WebhookJobs
from seahub.dtable.utils import check_dtable_admin_permission
from seaserv import seafile_api

logger = logging.getLogger(__name__)


def _resource_check(workspace_id, table_name):
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        error_msg = 'Workspace %s not found.' % workspace_id
        return api_error(status.HTTP_404_NOT_FOUND, error_msg), None, None

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        error_msg = 'Library %s not found.' % repo_id
        return api_error(status.HTTP_404_NOT_FOUND, error_msg), None, None

    dtable = DTables.objects.get_dtable(workspace, table_name)
    if not dtable:
        error_msg = 'dtable %s not found.' % table_name
        return api_error(status.HTTP_404_NOT_FOUND, error_msg), None, None

    return None, workspace, dtable


class WebhooksView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name):
        # resource check
        error, workspace, dtable = _resource_check(workspace_id, name)
        if error:
            return error
        username = request.user.username
        # permission check
        if not check_dtable_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        webhooks = Webhooks.objects.filter(dtable_uuid=dtable.uuid.hex)
        return Response({'webhook_list': [hook.to_dict() for hook in webhooks]})

    def post(self, request, workspace_id, name):
        # arguments check
        url = request.data.get('url')
        url = url.strip() if url else url
        if not url:
            return api_error(status.HTTP_400_BAD_REQUEST, 'url invalid.')
        if not re.match(r'^https?://', url):
            return api_error(status.HTTP_400_BAD_REQUEST, 'url invalid')

        secret = request.data.get('secret')
        secret = secret.strip() if secret else secret
        # resource check
        error, workspace, dtable = _resource_check(workspace_id, name)
        if error:
            return error
        username = request.user.username
        # permission check
        if not check_dtable_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if Webhooks.objects.filter(dtable_uuid=dtable.uuid.hex, url=url).exists():
            return api_error(status.HTTP_409_CONFLICT, 'Webhook exists.')

        data = {
            'dtable_uuid': dtable.uuid.hex,
            'url': url,
            'creator': username
        }
        if secret:
            settings = json.dumps({
                'secret': secret
            })
            data['settings'] = settings
        try:
            webhook = Webhooks.objects.create(**data)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'webhook': webhook.to_dict()})


class WebhookView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name, webhook_id):
        # resource check
        error, workspace, dtable = _resource_check(workspace_id, name)
        if error:
            return error
        webhook = Webhooks.objects.filter(id=webhook_id).first()
        if not webhook or webhook.dtable_uuid != dtable.uuid.hex:
            return api_error(status.HTTP_404_NOT_FOUND, 'Webhook not found.')
        username = request.user.username
        # permission check
        if not check_dtable_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        return Response({
            'webhook': webhook.to_dict()
        })

    def put(self, request, workspace_id, name, webhook_id):
        # arguments
        url = request.data.get('url')
        if url:
            url = url.strip()
        if not re.match(r'^https?://', url):
            return api_error(status.HTTP_400_BAD_REQUEST, 'url invalid')
        secret = request.data.get('secret')
        if secret:
            secret = secret.strip()
        # resouce check
        error, workspace, dtable = _resource_check(workspace_id, name)
        if error:
            return error
        webhook = Webhooks.objects.filter(id=webhook_id).first()
        if not webhook or webhook.dtable_uuid != dtable.uuid.hex:
            return api_error(status.HTTP_404_NOT_FOUND, 'Webhook not found.')
        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if Webhooks.objects.filter(dtable_uuid=dtable.uuid.hex, url=url).exclude(id=webhook_id).exists():
            return api_error(status.HTTP_409_CONFLICT, 'Webhook exists.')

        # update
        if url:
            webhook.url = url
        if secret:
            hook_settings = webhook.hook_settings
            if hook_settings:
                hook_settings['secret'] = secret
            else:
                hook_settings = {'secret': secret}
            webhook.settings = json.dumps(hook_settings)
        webhook.is_valid = True
        try:
            webhook.save()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({
            'webhook': webhook.to_dict()
        })

    def delete(self, request, workspace_id, name, webhook_id):
        # resource check
        error, workspace, dtable = _resource_check(workspace_id, name)
        if error:
            return error
        webhook = Webhooks.objects.filter(id=webhook_id).first()
        if not webhook or webhook.dtable_uuid != dtable.uuid.hex:
            return api_error(status.HTTP_404_NOT_FOUND, 'Webhook not found.')
        username = request.user.username
        # permission check
        if not check_dtable_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        with transaction.atomic():
            try:
                Webhooks.objects.filter(id=webhook_id).delete()
                WebhookJobs.objects.filter(webhook_id=webhook_id).delete()
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})
