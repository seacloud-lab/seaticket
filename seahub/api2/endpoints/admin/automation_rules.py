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
from seahub.dtable.models import DTableAutomationRules

logger = logging.getLogger(__name__)


class AdminAutomationRulesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        Get all auto rules

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

        rule_list = DTableAutomationRules.objects.all().order_by('-ctime')[start:end]
        automation_rule_list = [notice.to_dict() for notice in list(rule_list)]

        total_count = DTableAutomationRules.objects.count()
        return Response({'automation_rule_list': automation_rule_list, 'count': total_count})


class AdminAutomationRuleView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def delete(self, request, rid):
        """
            Delete a sys auto rule

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

        automation_rule = DTableAutomationRules.objects.filter(id=rid).first()
        if not automation_rule:
            error_msg = 'notification %s not found.' % rid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            automation_rule.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class AdminAutomationInvalidRulesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        Get all invalid auto rules
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
            auto_rule_list = DTableAutomationRules.objects.filter(is_valid=False)[start:end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        invalid_automation_rule_list = [rule.to_dict() for rule in auto_rule_list]

        total_count = DTableAutomationRules.objects.filter(is_valid=False).count()
        return Response({'invalid_automation_rule_list': invalid_automation_rule_list, 'count': total_count})

    def delete(self, request):
        """ delete invalid rules
        """

        try:
            DTableAutomationRules.objects.filter(is_valid=False).delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})
