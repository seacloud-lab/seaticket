# -*- coding: utf-8 -*-
import datetime
import calendar
import json
import logging

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.api2.permissions import IsOrgAdminUser
from seahub.profile.models import Profile
from seahub.group.models import Group
from seahub.project.db_utils import query_ai_statistics_overview, query_ai_statistics_detail
from seahub.project.models import Projects, Workspaces
from seahub.group.utils import group_id_to_name
from seahub.base.templatetags.seahub_tags import email2nickname

logger = logging.getLogger(__name__)

def _get_profiles_dict(usernames):
    if not usernames:
        return {}
    profiles = Profile.objects.filter(user__in=usernames)
    return {p.user: p.nickname for p in profiles}

class OrgAdminAIStatisticsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

    def get(self, request, org_id):
        org_id = int(org_id)
        if not request.user.org or request.user.org.org_id != org_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        date = request.GET.get('date')
        month = request.GET.get('month')

        if not date and not month:
            return api_error(status.HTTP_400_BAD_REQUEST, 'date or month required')
        if date:
            try:
                date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
                date_range = [date.isoformat(), date.isoformat()]
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'date invalid')
        elif month:
            try:
                start_date = datetime.datetime.strptime(month, '%Y%m').date()
                _, last_day_num = calendar.monthrange(start_date.year, start_date.month)
                end_date = datetime.date(start_date.year, start_date.month, last_day_num)
                date_range = [start_date.isoformat(), end_date.isoformat()]
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid')

        group_by = request.GET.get('group_by', 'user')
        if group_by not in ('user', 'project', 'group'):
            return api_error(status.HTTP_400_BAD_REQUEST,
                             'group_by invalid. Must be "user" or "project" or "group"')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page

        try:
            if group_by == 'project':
                return self._stats_by_project(query_ai_statistics_overview('project_uuid', date_range, org_id), start, end)
            elif group_by == 'user':
                return self._stats_by_user(query_ai_statistics_overview('username', date_range, org_id), start, end)
            elif group_by == 'group':
                return self._stats_by_group(query_ai_statistics_overview('group_id', date_range, org_id), start, end)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal server error')

    def _stats_by_project(self, records, start, end):
        # page result
        total_count = records.count()
        stats = records[start:end]
        if not stats:
            return Response({'results': [], 'count': 0})

        project_uuids = [item['project_uuid'] for item in stats]
        projects = Projects.objects.filter(uuid__in=project_uuids)
        projects_dict = {str(p.uuid).replace('-', ''): p for p in projects}

        workspace_ids = [p.workspace_id for p in projects]
        workspaces = Workspaces.objects.filter(id__in=workspace_ids)

        usernames = [w.owner for w in workspaces if '@seafile_group' not in w.owner]
        profiles_dict = _get_profiles_dict(usernames)

        # {workspace_id:{'owner': owner, 'group_name': group_name, 'nickname': nickname}}
        workspace_info = {}
        for w in workspaces:
            if '@seafile_group' in w.owner:
                group_id = int(w.owner.split('@')[0])
                workspace_info[w.id] = {'owner': w.owner, 'group_name': group_id_to_name(group_id)}
            else:
                workspace_info[w.id] = {'owner': w.owner, 'nickname': profiles_dict.get(w.owner, '')}

        results = []
        for item in stats:
            project_uuid = item['project_uuid']
            project = projects_dict.get(project_uuid)
            result = {
                'project_uuid': project_uuid,
                'total_credit_used': item['total_credit_used'],
                'project_name': project.name if project else None
            }
            if project:
                ws_info = workspace_info.get(project.workspace_id, {})
                result['owner'] = ws_info.get('owner')
                if 'group_name' in ws_info:
                    result['group_name'] = ws_info['group_name']
                else:
                    result['nickname'] = ws_info.get('nickname', '')
            results.append(result)

        return Response({'results': results, 'count': total_count})

    def _stats_by_user(self, records, start, end):
        # page result
        stats = records[start:end]
        if not stats:
            return Response({'results': [], 'count': 0})

        usernames = [item['username'] for item in stats]

        total_count = records.count()
        profiles_dict = _get_profiles_dict(usernames)

        results = []
        for item in stats:
            username = item['username']
            results.append({
                'total_credit_used': item['total_credit_used'],
                'username': username,
                'nickname': profiles_dict.get(username, email2nickname(username)),
            })

        return Response({'results': results, 'count': total_count})

    def _stats_by_group(self, records, start, end):
        stats = records[start:end]
        if not stats:
            return Response({'results': [], 'count': 0})

        total_count = records.count()

        group_ids = [item['group_id'] for item in stats]
        groups = Group.objects.filter(group_id__in=group_ids)
        group_id_to_name_map = {}
        group_id_to_creator_map = {}
        for g in groups:
            group_id_to_name_map[g.group_id] = g.group_name
            group_id_to_creator_map[g.group_id] = g.creator_name
        profiles_dict = _get_profiles_dict(set(group_id_to_creator_map.values()))

        results = []
        for item in stats:
            creator = group_id_to_creator_map.get(item['group_id'], '')
            results.append({
                'group_id': item['group_id'],
                'group_name': group_id_to_name_map.get(item['group_id'], ''),
                'creator': creator,
                'creator_name': profiles_dict.get(creator, email2nickname(creator)),
                'total_credit_used': item['total_credit_used']
            })

        return Response({'results': results, 'count': total_count})


class OrgAdminAIStatisticsDetailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

    def get(self, request, org_id):
        org_id = int(org_id)
        if not request.user.org or request.user.org.org_id != org_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        
        group_by = request.GET.get('group_by')
        if group_by == 'project':
            group_by = 'project_uuid'
        elif group_by == 'user':
            group_by = 'username'
        elif group_by != 'date':
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be sub-group_by of "project" or "group" or "date"')

        condition = request.GET.get('condition')
        if isinstance(condition, str):
            try:
                condition = json.loads(condition)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'condition invalid. Must be an object')
        if not isinstance(condition, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'condition invalid. Must be an object')
        elif not condition:
            return api_error(status.HTTP_400_BAD_REQUEST, 'condition must cannot be empty')
        
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        if not start_date or not end_date:
            return api_error(status.HTTP_400_BAD_REQUEST, 'range of date must be provided')
        start_date = datetime.datetime.strptime(start_date.split('T')[0], '%Y-%m-%d').date()
        end_date = datetime.datetime.strptime(end_date.split('T')[0], '%Y-%m-%d').date()

        scenarios_str = request.GET.get('scenarios')
        scenarios = [s.strip() for s in scenarios_str.split(',') if s.strip()] if scenarios_str else []

        query_set = query_ai_statistics_detail(group_by, [start_date, end_date], condition, scenarios=scenarios or None)

        if group_by == 'date':
            results = []
            for item in query_set:
                item['total_credit_used'] = item['total_credit_used']
                results.append(item)
        elif group_by == 'username':
            query_set = query_set[:30]
            usernames = [item['username'] for item in query_set if item['username'] != 'seaqa-indexer']
            profiles_dict = _get_profiles_dict(usernames)
            results = []
            for item in query_set:
                nickname = item['username']
                if item != 'seaqa-indexer':
                    nickname = profiles_dict.get(item['username'], email2nickname(item['username']))
                results.append({
                    'user': nickname,
                    'total_credit_used': item['total_credit_used'],
                    'total_input_tokens': item['total_input_tokens'],
                    'total_output_tokens': item['total_output_tokens']
                })
            results.reverse()
        elif group_by == 'project_uuid':
            query_set = query_set[:30]
            project_uuids = [item['project_uuid'] for item in query_set]
            projects = Projects.objects.filter(uuid__in=project_uuids)
            project_uuid_name_map = {
                str(project.uuid).replace('-', ''): project.name
                for project in projects
            }
            results = [
                {
                    'project': project_uuid_name_map.get(item['project_uuid'], '<Unknow project>'),
                    'total_credit_used': item['total_credit_used'],
                    'total_input_tokens': item['total_input_tokens'],
                    'total_output_tokens': item['total_output_tokens']
                }
                for item in query_set
            ]
            results.reverse()

        return Response({'results': results})


class OrgAdminAIStatisticsOverviewView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

    @staticmethod
    def _get_month_range(date_obj):
        _, last_day_num = calendar.monthrange(date_obj.year, date_obj.month)
        start_date = datetime.date(date_obj.year, date_obj.month, 1)
        end_date = datetime.date(date_obj.year, date_obj.month, last_day_num)
        return [start_date.isoformat(), end_date.isoformat()]

    @staticmethod
    def _get_total_credit_used(date_range, org_id):
        records = query_ai_statistics_overview('org_id', date_range, org_id)
        record = records.first()
        return record['total_credit_used'] if record else 0

    @staticmethod
    def _get_scenario_percentages(date_range, org_id):
        records = list(query_ai_statistics_overview('scenario', date_range, org_id))
        if not records:
            return {'results': [], 'count': 0}

        total_credit_used = sum(item['total_credit_used'] for item in records)
        results = []
        for item in records:
            percentage = 0
            if total_credit_used:
                percentage = round(item['total_credit_used'] / total_credit_used, 3)
            results.append({
                'scenario': item.get('scenario') or '',
                'total_credit_used': round(item['total_credit_used'], 0),
                'percentage': percentage,
            })

        return {'results': results, 'count': len(results)}

    @staticmethod
    def _get_month_start(date_obj):
        return datetime.date(date_obj.year, date_obj.month, 1)

    @staticmethod
    def _add_months(date_obj, months):
        # Keep the date at month start to avoid day overflow issues.
        month_index = date_obj.month - 1 + months
        year = date_obj.year + month_index // 12
        month = month_index % 12 + 1
        return datetime.date(year, month, 1)

    def _get_monthly_credits(self, org_id, months_count=6):
        current_month_start = self._get_month_start(datetime.date.today())
        results = []
        for offset in range(months_count - 1, -1, -1):
            month_start = self._add_months(current_month_start, -offset)
            date_range = self._get_month_range(month_start)
            results.append({
                'month': month_start.strftime('%Y-%m'),
                'total_credit_used': round(self._get_total_credit_used(date_range, org_id), 0),
            })
        return {'results': results, 'count': len(results)}

    @staticmethod
    def _get_daily_credits_current_month(org_id):
        today = datetime.date.today()
        month_start = datetime.date(today.year, today.month, 1)
        query_set = query_ai_statistics_detail('date', [month_start, today], {'org_id': org_id})

        date_to_credit = {}
        for item in query_set:
            date_to_credit[item['date']] = item['total_credit_used']

        results = []
        current_date = month_start
        while current_date <= today:
            results.append({
                'date': current_date.isoformat(),
                'total_credit_used': round(date_to_credit.get(current_date, 0), 0),
            })
            current_date += datetime.timedelta(days=1)

        return {'results': results, 'count': len(results)}

    def get(self, request, org_id):
        org_id = int(org_id)
        if not request.user.org or request.user.org.org_id != org_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        today = datetime.date.today()
        current_month_range = self._get_month_range(today)
        group_by = request.GET.get('group_by')

        if group_by and group_by not in ('scenario', 'month', 'date'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be "scenario" or "month" or "date"')

        try:
            if group_by == 'scenario':
                return Response(self._get_scenario_percentages(current_month_range, org_id))
            if group_by == 'month':
                return Response(self._get_monthly_credits(org_id))
            if group_by == 'date':
                return Response(self._get_daily_credits_current_month(org_id))

            if today.month == 1:
                last_month_date = datetime.date(today.year - 1, 12, 1)
            else:
                last_month_date = datetime.date(today.year, today.month - 1, 1)
            last_month_range = self._get_month_range(last_month_date)

            current_month_credit = self._get_total_credit_used(current_month_range, org_id)
            last_month_credit = self._get_total_credit_used(last_month_range, org_id)
            month_on_month_change = current_month_credit - last_month_credit
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal server error')

        return Response({
            'current_month_credit': round(current_month_credit, 0),
            'last_month_credit': round(last_month_credit, 0),
            'month_on_month_change': round(month_on_month_change, 0),
        })
