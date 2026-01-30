# -*- coding: utf-8 -*-
from django.conf import settings as dj_settings
from rest_framework.response import Response
from rest_framework.views import APIView

SEAQA_VERSION = getattr(dj_settings, 'SEAQA_VERSION', 'Dev')

class ServerInfoView(APIView):

    def get(self, request, format=None):
        info = {
            'version': SEAQA_VERSION,
        }

        edition = 'enterprise edition'

        info['edition'] = edition
        return Response(info)
