import os
import logging

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from django.utils.translation import gettext as _
from django.template.defaultfilters import filesizeformat

from seahub.organizations.models import OrgAdminSettings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.organizations.permissions import IsOrgAdmin
from seahub.api2.permissions import IsOrgAdminUser
from seahub.organizations.settings import ENABLE_ORG_LOGO

logger = logging.getLogger(__name__)


class OrgAdminSettingsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdmin,)

    def get(self, request):
        org_id = request.user.org.org_id
        try:
            settings = OrgAdminSettings.objects.get_admin_settings(org_id)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response(settings)

    def put(self, request):
        org_id = request.user.org.org_id
        try:
            OrgAdminSettings.objects.add_or_update(org_id, **dict(request.data.items()))
            settings = OrgAdminSettings.objects.get_admin_settings(org_id)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response(settings)


class OrgAdminOrgLogoView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

    def get(self, request, org_id):
        if not ENABLE_ORG_LOGO:
            error_msg = _('Feature is not enabled.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not request.user.permissions.can_use_advanced_customization():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org_id = request.user.org.org_id
        try:
            org_logo_url = OrgAdminSettings.objects.get_org_logo_url(org_id)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'logo_path': org_logo_url})

    def post(self, request, org_id):
        from seahub.avatar.settings import AVATAR_ALLOWED_FILE_EXTS, AVATAR_MAX_SIZE

        if not ENABLE_ORG_LOGO:
            error_msg = _('Feature is not enabled.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not request.user.permissions.can_use_advanced_customization():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org_id = request.user.org.org_id

        image_file = request.FILES.get('file', None)
        if not image_file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        (root, ext) = os.path.splitext(image_file.name.lower())
        if AVATAR_ALLOWED_FILE_EXTS and ext not in AVATAR_ALLOWED_FILE_EXTS:
            error_msg = _("%(ext)s is an invalid file extension. Authorized extensions are : %(valid_exts_list)s") % {'ext' : ext, 'valid_exts_list' : ", ".join(AVATAR_ALLOWED_FILE_EXTS)}
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if image_file.size > AVATAR_MAX_SIZE:
            error_msg = _("Your file is too big (%(size)s), the maximum allowed size is %(max_valid_size)s") % { 'size' : filesizeformat(image_file.size), 'max_valid_size' : filesizeformat(AVATAR_MAX_SIZE)}
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            OrgAdminSettings.objects.save_org_logo(org_id, image_file)
            org_logo_url = OrgAdminSettings.objects.get_org_logo_url(org_id)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'logo_path': org_logo_url})

    def delete(self, request, org_id):
        if not ENABLE_ORG_LOGO:
            error_msg = _('Feature is not enabled.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not request.user.permissions.can_use_advanced_customization():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org_id = request.user.org.org_id
        try:
            OrgAdminSettings.objects.delete_org_logo(org_id)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'success': True})
