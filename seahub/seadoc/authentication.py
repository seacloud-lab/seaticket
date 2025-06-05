import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication

from seahub.base.accounts import User
from seahub.dtable.models import CustomAssetUUID
from seahub.utils import uuid_str_to_36_chars



class InternalAccessTokenAuthentication(BaseAuthentication):

    def authenticate(self, request):

        access_token = request.COOKIES.get('access-token')
        if not access_token:
            return None

        try:
            payload = jwt.decode(access_token, settings.DTABLE_PRIVATE_KEY, algorithms=['HS256'])
        except:
            return None
        if not payload.get('is_internal'):
            return None

        file_uuid = request.parser_context['kwargs'].get('file_uuid')
        asset = CustomAssetUUID.objects.get_by_uuid(file_uuid)
        if not asset:
            return None
        dtable_uuid = uuid_str_to_36_chars(asset.dtable_uuid)
        if payload.get('dtable_uuid') != dtable_uuid:
            return None

        username = payload.get('username', 'internal')
        user = User(username)
        user.is_from_cookie = True
        user.id = username  # for throttling identity

        return (user, None)
