# -*- coding: utf-8 -*-
import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTableNotificationRules

logger = logging.getLogger(__name__)

class AdminNotificationRulesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self,request):
        """
        Get all notificationrules rules

        only admin can perform this action
        """


        try:
            per_page = int(request.GET.get('per_page',''))
            page = int(request.GET.get('page',''))
        except ValueError:
            per_page = 25
            page = 1
        
        start = (page - 1) * per_page
        end = page * per_page
        
        notice_list = DTableNotificationRules.objects.all().order_by('-ctime')[start:end]
        notification_rule_list = [notice.to_dict() for notice in list(notice_list)]

        total_count = DTableNotificationRules.objects.count()
        return Response({'notification_rule_list': notification_rule_list, 'count': total_count})


class AdminNotificationRuleView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def delete(self, request, rid):
        """
            Delete a sysnotificationrules rule

            only admin can perform this action
        """

        try:
            rid = int(rid)
        except ValueError:
            error_msg = 'rid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if rid <= 0:
            error_msg = 'rid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        notification = DTableNotificationRules.objects.filter(id=rid).first()
        if not notification:
            error_msg = 'notification %s not found.' % rid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            notification.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        return Response({'success':True})


class AdminNotificationInvalidRulesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        Get all invalid notification rules
        only admin can perform this action
        """

        try:
            per_page = int(request.GET.get('per_page', ''))
            page = int(request.GET.get('page', ''))
        except ValueError:
            per_page = 25
            page = 1

        start = (page - 1) * per_page
        end = page * per_page
        try:
            notice_rule_list = DTableNotificationRules.objects.filter(is_valid=False)[start:end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        invalid_notification_rule_list = [rule.to_dict() for rule in notice_rule_list]

        total_count = DTableNotificationRules.objects.filter(is_valid=False).count()
        return Response({'invalid_notification_rule_list': invalid_notification_rule_list, 'count': total_count})

    def delete(self, request):
        """ delete invalid rules
        """

        try:
            DTableNotificationRules.objects.filter(is_valid=False).delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})
