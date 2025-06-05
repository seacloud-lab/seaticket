# -*- coding: utf-8 -*-
from django.conf import settings as dj_settings
from rest_framework.response import Response
from rest_framework.views import APIView
from seahub.utils import is_pro_version

SEATABLE_VERSION = getattr(dj_settings, 'SEATABLE_VERSION', 'Dev')

class ServerInfoView(APIView):

    def get(self, request, format=None):
        info = {
            'version': SEATABLE_VERSION,
        }

        edition = 'developer edition'

        if is_pro_version():
            edition = 'enterprise edition'

        info['edition'] = edition
        return Response(info)
