import logging
import urllib
import os

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.dtable.models import DTableAPIToken
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.settings import DTABLE_WEB_SERVICE_URL, TEMPLATE_BASE_API_TOKEN, TEMPLATE_TABLE_NAME, INNER_DTABLE_DB_URL

logger = logging.getLogger(__name__)


def convert_remote_image_url_to_local(url):
    if not url or 'asset' not in url:
        return url

    path = '/'.join(url.split('asset')[1].split('/')[2:])
    url = urllib.parse.urljoin(DTABLE_WEB_SERVICE_URL, os.path.join('asset', path))

    return url

def get_template_data(template):
    data = dict()
    data['name'] = template.get('name', '')
    data['display_name'] = template.get('display_name', '')
    data['description'] = template.get('description', '')
    data['category'] = template.get('category', '')
    data['link'] = template.get('link', '')
    data['card_image_url'] = template.get('card_image')[0] if template.get('card_image') else ''
    data['card_image_expanded_url'] = template.get('card_image_expanded')[0] if template.get('card_image_expanded') else ''
    return data

class TemplatesView(APIView):
    throttle_classes = (UserRateThrottle,)

    def get(self, request):

        dtable_api_token = DTableAPIToken.objects.filter(token=TEMPLATE_BASE_API_TOKEN).select_related('dtable').first()
        if not dtable_api_token:
            logger.error('api_token %s for template not found', TEMPLATE_BASE_API_TOKEN)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        dtable_db_api = DTableDBAPI('dtable-web', dtable_api_token.dtable.uuid.hex, INNER_DTABLE_DB_URL)

        sql = f"SELECT * FROM `{TEMPLATE_TABLE_NAME}`"

        rows = dtable_db_api.query(sql, convert=True).get('results', [])
        template_list = [get_template_data(template) for template in rows]

        return Response({'template_list': template_list})
