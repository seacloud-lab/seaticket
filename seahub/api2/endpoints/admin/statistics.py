# -*- coding: utf-8 -*-
import pytz
import datetime
import logging
import requests
import json

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.utils import timezone
from django.conf import settings

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.ccnet_db.ccnet.organizations import get_orgs_base_info
from seahub.dtable.models import DTableAutomationRulesUserStatistics, DTableAutomationRulesOrgStatistics, \
    DTableAutomationRules, DTableAutomationRulesTaskLog, DTables, DTableExternalAppsUserStatistics, \
    DTableExternalAppsOrgStatistics
from seahub.utils import get_user_activity_stats_by_day, DTABLE_EVENTS_ENABLED, uuid_str_to_36_chars
from seahub.utils.timeutils import datetime_to_isoformat_timestr

logger = logging.getLogger(__name__)


def get_time_offset():
    timezone_name = timezone.get_current_timezone_name()
    offset = pytz.timezone(timezone_name).localize(datetime.datetime.now()).strftime('%z')
    return offset[:3] + ':' + offset[3:]


def get_init_data(start_time, end_time, init_data=0):
    res = {}
    start_time = start_time.replace(hour=0).replace(minute=0).replace(second=0)
    end_time = end_time.replace(hour=0).replace(minute=0).replace(second=0)
    time_delta = end_time - start_time
    date_length = time_delta.days + 1
    for offset in range(date_length):
        offset = offset * 24
        dt = start_time + datetime.timedelta(hours=offset)
        if isinstance(init_data, dict):
            res[dt] = init_data.copy()
        else:
            res[dt] = init_data
    return res


class ActiveUsersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        # permission check
        if not request.user.admin_permissions.can_view_statistic():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if not DTABLE_EVENTS_ENABLED:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Events not enabled.')

        # argument check
        start_time = request.GET.get("start", "")
        if not start_time:
            error_msg = "Start time can not be empty"
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        end_time = request.GET.get("end", "")
        if not end_time:
            error_msg = "End time can not be empty"
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # format datetime str
        try:
            start_time = datetime.datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            error_msg = "Start time %s invalid" % start_time
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            end_time = datetime.datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            error_msg = "End time %s invalid" % end_time
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        user_activity_stats = get_user_activity_stats_by_day(start_time, end_time, get_time_offset())

        res_data = []
        init_data = get_init_data(start_time, end_time)
        for e in user_activity_stats:
            init_data[e[0]] = e[1]
        for k, v in list(init_data.items()):
            res_data.append({'datetime': datetime_to_isoformat_timestr(k), 'count': v})

        return Response({"active_users": sorted(res_data, key=lambda x: x['datetime'])})


class AdminRunScriptStatisticsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        if not request.user.admin_permissions.can_view_statistic():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        # arguments check
        month = request.GET.get('month')
        if not month:
            month = str(datetime.datetime.today())[:7]
        else:
            try:
                month = datetime.datetime.strptime(month, '%Y%m')
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid.')
            month = str(month)[:7]
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        is_user = to_python_boolean(request.GET.get('is_user', 'true'))
        order_by = request.GET.get('order_by')

        statistics_url = settings.SEATABLE_FAAS_URL.strip('/') + '/admin/statistics/scripts-running/' + \
            ('by-user/' if is_user else 'by-org/')
        headers = {'Authorization': 'Token ' + settings.SEATABLE_FAAS_AUTH_TOKEN}
        params = {
            'page': page,
            'per_page': per_page,
            'month': month,
            'order_by': order_by
        }
        try:
            response = requests.get(statistics_url, params=params, headers=headers)
            response_dict = response.json()
        except requests.ConnectionError as e:
            return api_error(status.HTTP_404_NOT_FOUND, 'FAAS scheduler not properly configured')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        results, count = response_dict['results'], response_dict['count']

        if is_user and count:
            for result in results:
                result['name'] = email2nickname(result['username'])
        if not is_user and count:
            org_ids = [result['org_id'] for result in results]
            orgs_info_dict = get_orgs_base_info(org_ids)
            for result in results:
                if result['org_id'] in orgs_info_dict:
                    result['org_name'] = orgs_info_dict[result['org_id']]['org_name']
                else:  # normally it won't run here
                    result['org_name'] = result['org_id']

        return Response({
            'results': results,
            'count': count
        })

class AdminAutomationRulesStatisticView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        if not request.user.admin_permissions.can_view_statistic():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        # arguments check
        month = request.GET.get('month')
        if not month:
            today = datetime.datetime.today()
            today_year = today.year
            today_month = today.month
            month = datetime.date(today_year, today_month, 1)
        else:
            try:
                month = datetime.datetime.strptime(month, '%Y%m').date()
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid.')
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page
        is_user = to_python_boolean(request.GET.get('is_user', 'true'))
        order_by = request.GET.get('order_by')
        if order_by and order_by != 'trigger_count':
            return api_error(status.HTTP_400_BAD_REQUEST, 'order_by invalid')
        if is_user:
            auto_rules_results = DTableAutomationRulesUserStatistics.objects.filter(trigger_date=month)

        else:
            auto_rules_results = DTableAutomationRulesOrgStatistics.objects.filter(trigger_date=month)

        if order_by:
            auto_rules_results = auto_rules_results.order_by(order_by)
        results = [res.to_dict() for res in auto_rules_results[start:end]]
        count = auto_rules_results.count()
        if is_user and count:
            for result in results:
                result['name'] = email2nickname(result['username'])
        if not is_user and count:
            org_ids = [result['org_id'] for result in results]
            orgs_info_dict = get_orgs_base_info(org_ids)
            for result in results:
                if result['org_id'] in orgs_info_dict:
                    result['org_name'] = orgs_info_dict[result['org_id']]['org_name']
                else:  # normally it won't run here
                    result['org_name'] = result['org_id']

        return Response({
            'results': results,
            'count': count
        })

class AdminAutomationRulesStatisticDetailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)


    def _rule_id_to_name_map(self, rule_ids):
        auto_rules = DTableAutomationRules.objects.filter(pk__in=rule_ids)
        id_name_map = {}.fromkeys(rule_ids, ("", True))

        for rule in auto_rules:
            trigger = json.loads(rule.trigger)
            rule_id = rule.id
            rule_name = trigger.get('rule_name')
            id_name_map[rule_id] = (rule_name, False)

        return id_name_map

    def _base_id_to_name_map(self, uuids):

        dtables = DTables.objects.filter(uuid__in=uuids)
        id_name_map = {}
        for dtable in dtables:
            uuid = dtable.uuid.hex
            name = dtable.name
            id_name_map[uuid] = name
        return id_name_map


    def get(self, request):
        if not request.user.admin_permissions.can_view_statistic():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        # arguments check
        month_str = request.GET.get('month')
        is_user = to_python_boolean(request.GET.get('is_user', 'true'))
        owner_name = request.GET.get('owner')
        org_id = request.GET.get('org_id', -1)
        if not month_str:
            today = datetime.datetime.today()
            month_str = today.strftime('%Y%m')
        try:
            datetime.datetime.strptime(month_str, '%Y%m')
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid.')

        try:
            if is_user:
                raw_sql_user = """
                SELECT id, rule_id, dtable_uuid, COUNT('id') as total_count FROM auto_rules_task_log
                WHERE owner=%(owner_name)s AND DATE_FORMAT(trigger_time, "%%Y%%m")=%(month_str)s
                GROUP BY rule_id
                ORDER BY total_count DESC
                """

                auto_rules_results = DTableAutomationRulesTaskLog.objects.raw(
                    raw_sql_user,
                    params={
                        "owner_name": owner_name,
                        "month_str": month_str
                    }
                )
            else:
                raw_sql_org = """
                SELECT id, rule_id, dtable_uuid, COUNT('id') as total_count FROM auto_rules_task_log
                WHERE org_id=%(org_id)s AND DATE_FORMAT(trigger_time, "%%Y%%m")=%(month_str)s
                GROUP BY rule_id
                ORDER BY total_count DESC
                """

                auto_rules_results = DTableAutomationRulesTaskLog.objects.raw(
                    raw_sql_org,
                    params={
                        "org_id": int(org_id),
                        "month_str": month_str
                    }
                )
            results = []
            rule_ids = [res.rule_id for res in auto_rules_results]
            dtable_uuids = set([res.dtable_uuid for res in auto_rules_results])


            rule_id_name_map = self._rule_id_to_name_map(rule_ids)
            base_id_name_map = self._base_id_to_name_map(dtable_uuids)

            for res in auto_rules_results:
                dtable_uuid = res.dtable_uuid
                rule_id = res.rule_id
                rule_name, deleted = rule_id_name_map.get(rule_id)
                base_name = base_id_name_map.get(dtable_uuid) or dtable_uuid
                results.append({
                    'rule_id': res.rule_id,
                    'rule_name':rule_name,
                    'rule_deleted': deleted,
                    'dtable_uuid': uuid_str_to_36_chars(dtable_uuid),
                    'dtable_name': base_name,
                    'count': res.total_count,
                })
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({
            'results': results,
        })


class AdminExternalAppsStatisticView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        if not request.user.admin_permissions.can_view_statistic():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        # arguments check
        month = request.GET.get('month')
        if not month:
            today = datetime.datetime.today()
            today_year = today.year
            today_month = today.month
            month = datetime.date(today_year, today_month, 1)
        else:
            try:
                month = datetime.datetime.strptime(month, '%Y%m').date()
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid.')
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page
        is_personal = to_python_boolean(request.GET.get('is_user', 'true'))
        order_by = request.GET.get('order_by')
        if is_personal:
            external_apps_results = DTableExternalAppsUserStatistics.objects.filter(visit_date=month)

        else:
            external_apps_results = DTableExternalAppsOrgStatistics.objects.filter(visit_date=month)

        if order_by:
            external_apps_results = external_apps_results.order_by(order_by)
        results = [res.to_dict() for res in external_apps_results[start:end]]
        count = external_apps_results.count()
        if is_personal and count:
            for result in results:
                result['name'] = email2nickname(result['username'])
        if not is_personal and count:
            org_ids = [result['org_id'] for result in results]
            orgs_info_dict = get_orgs_base_info(org_ids)
            for result in results:
                if result['org_id'] in orgs_info_dict:
                    result['org_name'] = orgs_info_dict[result['org_id']]['org_name']
                else:  # normally it won't run here
                    result['org_name'] = result['org_id']

        return Response({
            'results': results,
            'count': count
        })
