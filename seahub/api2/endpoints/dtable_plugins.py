import logging

from django.db.models import F
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import datetime

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTableSystemPlugins, DTablePluginsInstallCount

logger = logging.getLogger(__name__)


class DTableSystemPluginsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
            list all plugins in system
        """

        try:
            plugins = DTableSystemPlugins.objects.all()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        plugin_list = list()
        for plugin in plugins:
            try:
                plugin_list.append(plugin.to_dict())
            except Exception as e:
                logger.error(e)
                continue

        return Response({'plugin_list': plugin_list})


class DTablePluginsView(APIView):
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
            list plugins by plugin_name list
        """

        plugin_name_list = request.GET.getlist('plugin_name', [])
        if not plugin_name_list:
            error_msg = 'plugin_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            plugins = DTableSystemPlugins.objects.filter(name__in=plugin_name_list)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        plugin_list = list()
        for plugin in plugins:
            try:
                plugin_list.append(plugin.to_dict())
            except Exception as e:
                logger.error(e)
                continue

        return Response({'plugin_list': plugin_list})


class DTablePluginsInstallCountView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        """
            count install plugin times
        """
        # argument check
        plugin_name = request.data.get('plugin_name', None)
        if not plugin_name:
            error_msg = 'plugin_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        plugin = DTableSystemPlugins.objects.filter(name=plugin_name).first()
        if not plugin:
            return api_error(status.HTTP_404_NOT_FOUND, 'Plugin %s not found' % plugin_name)

        plugin_install_count = DTablePluginsInstallCount.objects.filter(plugin_name=plugin_name)
        if plugin_install_count.exists():
            try:
                plugin_install_count.update(count=F('count')+1, updated_at=datetime.datetime.now())
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        else:
            try:
                DTablePluginsInstallCount.objects.create_plugins_install_count(plugin_name)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True})
