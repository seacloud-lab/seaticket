from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.views import APIView
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.dtable.models import DTables, DTableNotifications
from seahub.profile.models import Profile


class AdminDTableNotifications(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        username = request.GET.get('username')
        contact_email = request.GET.get('contact_email')
        dtable_uuid = request.GET.get('dtable_uuid')
        seen = request.GET.get('seen')
        page = request.GET.get('page', 1)
        per_page = request.GET.get('per_page', 25)

        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid invalid.')

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        filters = {'dtable_uuid': dtable.uuid.hex}

        if username:
            filters['username'] = username
        elif contact_email:
            username = Profile.objects.get_username_by_contact_email(contact_email)
            if not username:
                return api_error(status.HTTP_404_NOT_FOUND, 'User %s not found.' % contact_email)
            filters['username'] = username

        if seen:
            try:
                filters['seen'] = to_python_boolean(seen)
            except:
                pass

        try:
            page = int(page) if int(page) > 0 else 1
            per_page = int(per_page) if int(per_page) > 0 else 25
        except:
            page, per_page = 1, 25

        offset, limit = (page - 1) * per_page, per_page
        queryset = DTableNotifications.objects.filter(**filters).order_by('-created_at')
        notification_list = [notice.to_dict() for notice in queryset[offset: offset + limit]]

        return Response({
            'notification_list': notification_list,
            'count': queryset.count()
        })
