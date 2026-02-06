# -*- coding: utf-8 -*-
import datetime
import calendar
import json

from django.db.models import Sum
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
from seahub.project.db_utils import query_ai_statistics_data
from seahub.project.models import AIUsageStatistics, Projects, Workspaces
from seahub.group.utils import group_id_to_name
from seahub.base.templatetags.seahub_tags import email2nickname


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
                date_query = {'date': date.isoformat()}
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'date invalid')
        elif month:
            try:
                start_date = datetime.datetime.strptime(month, '%Y%m').date()
                _, last_day_num = calendar.monthrange(start_date.year, start_date.month)
                end_date = datetime.date(start_date.year, start_date.month, last_day_num)
                date_query = {'date__gte': start_date.isoformat(), 'date__lte': end_date.isoformat()}
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

        if group_by == 'project':
            return self._stats_by_project(query_ai_statistics_data('project_uuid', date_query, org_id), start, end)
        elif group_by == 'user':
            return self._stats_by_user(query_ai_statistics_data('username', date_query, org_id), start, end)
        elif group_by == 'group':
            return self._stats_by_group(query_ai_statistics_data('project_uuid', date_query, org_id), start, end)

    def _stats_by_project(self, records, start, end):
        # page result
        total_count = len(records)
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
                'total_cost': round(item['total_cost'], 2),
                'project_name': project.name if project else None,
                'model_list': item['model_list']
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

        usernames = [item['username'] for item in stats if item['username'] != 'seaqa-indexer']

        total_count = len(usernames)
        profiles_dict = _get_profiles_dict(usernames)

        results = []
        for item in stats:
            if item['username'] == 'seaqa-indexer':
                continue
            username = item['username']
            results.append({
                'total_cost': round(item['total_cost'], 2),
                'model_list': item['model_list'],
                'username': username,
                'nickname': profiles_dict.get(username, email2nickname(username)),
            })

        return Response({'results': results, 'count': total_count})

    def _stats_by_group(self, records, start, end):
        project_uuid_stats_map = {
            item['project_uuid']: {
                'model_list': item['model_list'],
                'total_cost': item['total_cost']
            }
            for item in records
        }
        project_uuids = list(project_uuid_stats_map.keys())

        projects = Projects.objects.filter(uuid__in=project_uuids)
        workspace_project_uuids_map = {}
        for p in projects:
            if p.workspace_id not in workspace_project_uuids_map:
                workspace_project_uuids_map[p.workspace_id] = []
            workspace_project_uuids_map[p.workspace_id].append(str(p.uuid).replace('-', ''))

        workspace_ids = set(workspace_project_uuids_map.keys())
        workspaces = Workspaces.objects.filter(id__in=workspace_ids)

        group_id_static_map = {}
        for w in workspaces:
            if '@seafile_group' in w.owner:
                group_id = int(w.owner.split('@')[0])
                project_uuids = workspace_project_uuids_map[w.id]
                group_id_static_map[group_id] = {
                    'model_list': set(),
                    'total_cost': 0
                }
                for p_uuid, st in project_uuid_stats_map.items():
                    if p_uuid in project_uuids:
                        group_id_static_map[group_id]['model_list'].update(st['model_list'])
                        group_id_static_map[group_id]['total_cost'] += st['total_cost']


        if not group_id_static_map:
            return Response({'results': [], 'count': 0})

        sorted_group_cost = sorted(group_id_static_map.items(), key=lambda x: x[1]['total_cost'], reverse=True)
        total_count = len(sorted_group_cost)
        paged_group_cost = sorted_group_cost[start:end]

        relative_group_ids = [group_id for (group_id, _) in paged_group_cost]
        groups = Group.objects.filter(group_id__in=relative_group_ids)
        group_id_to_name_map = {}
        group_id_to_creator_map = {}
        for g in groups:
            group_id_to_name_map[g.group_id] = g.group_name
            group_id_to_creator_map[g.group_id] = g.creator_name
        profiles_dict = _get_profiles_dict(set(group_id_to_creator_map.values()))

        results = []
        for (group_id, st) in paged_group_cost:
            creator = group_id_to_creator_map.get(group_id, '')
            results.append({
                'group_id': group_id,
                'group_name': group_id_to_name_map.get(group_id, ''),
                'creator': creator,
                'creator_name': profiles_dict.get(creator, email2nickname(creator)),
                'total_cost': round(st['total_cost'], 2),
                'model_list': list(st['model_list'])
            })

        return Response({'results': results, 'count': total_count})

def _get_start_end_date(condition):
    if (start_date := condition.get('start_date')) and (end_date := condition.get('end_date')):
        start_date = datetime.datetime.strptime(start_date, '%Y%m%d').date()
        end_date = datetime.datetime.strptime(end_date, '%Y%m%d').date()
        return start_date, end_date
    return None, None

class OrgAdminAIStatisticsDetailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

    def get(self, request, org_id):
        org_id = int(org_id)
        if not request.user.org or request.user.org.org_id != org_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        group_by = request.GET.get('group_by')
        if group_by not in ('user', 'project', 'group'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be "user" or "project" or "group"')
        
        view = request.GET.get('view')
        invalid_view = True
        if group_by == 'user' and view == 'daily':
            invalid_view = False
        elif group_by == 'project' and view in ('daily', 'user'):
            invalid_view = False
        elif group_by == 'group' and view in ('daily', 'project'):
            invalid_view = False
        if invalid_view:
            return api_error(status.HTTP_400_BAD_REQUEST, 'view invalid. Must be sub-group_by of "project" or "group", or dependent value "daily"')

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
        
        models = request.GET.get('models')
        if isinstance(models, str):
            try:
                models = json.loads(models)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'models invalid. Must be a list')
        if not isinstance(models, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'models invalid. Must be a list')
        elif not models:
            return api_error(status.HTTP_400_BAD_REQUEST, 'models must cannot be empty')
        
        # get usage detail
        query_args = {'model__in': models}
        if group_by == 'user':
            query_args['username'] = condition.get('username', '')
        elif group_by == 'project':
            query_args['project_uuid'] = condition.get('project_uuid', '').replace('-', '')
            start_date, end_date = _get_start_end_date(condition)
            if start_date and end_date:
                query_args['date__gte'] = start_date
                query_args['date__lte'] = end_date
        elif group_by == 'group':
            group_id = condition.get('group_id', -1)
            start_date, end_date = _get_start_end_date(condition)
            if start_date and end_date:
                query_args['date__gte'] = start_date
                query_args['date__lte'] = end_date

            # 1. get workspace id
            owner = f'{group_id}@seafile_group'
            workspace = Workspaces.objects.filter(owner=owner).first()
            if not workspace:
                return api_error(status.HTTP_404_NOT_FOUND, 'Workspace not found')
            
            # 2. get projects belong to this group (group workspace)
            project_uuids = Projects.objects.filter(workspace_id=workspace.pk).values_list('uuid', flat=True)
            query_args['project_uuid__in'] = project_uuids

        basic_query_set = AIUsageStatistics.objects.filter(**query_args)

        if view == 'daily':
            daliy_usage_query_set = basic_query_set.values('date').annotate(
                total_cost=Sum('cost'),
                total_input_tokens=Sum('input_tokens'),
                total_output_tokens=Sum('output_tokens')
            ).values('date', 'total_cost', 'total_input_tokens', 'total_output_tokens')
            results = list(daliy_usage_query_set)
        elif view == 'user':
            user_usage_query_set = basic_query_set.values('username').annotate(
                total_cost=Sum('cost'),
                total_input_tokens=Sum('input_tokens'),
                total_output_tokens=Sum('output_tokens')
            ).values('username', 'total_cost', 'total_input_tokens', 'total_output_tokens').order_by('-total_cost')[:30]
            usernames = [item['username'] for item in user_usage_query_set if item['username'] != 'seaqa-indexer']
            profiles_dict = _get_profiles_dict(usernames)
            results = []
            for item in user_usage_query_set:
                nickname = item['username']
                if item != 'seaqa-indexer':
                    nickname = profiles_dict.get(item['username'], email2nickname(item['username']))
                results.append({
                    'user': nickname,
                    'total_cost': item['total_cost'],
                    'total_input_tokens': item['total_input_tokens'],
                    'total_output_tokens': item['total_output_tokens']
                })
        elif view == 'project':
            project_usage_query_set = basic_query_set.values('project_uuid').annotate(
                total_cost=Sum('cost'),
                total_input_tokens=Sum('input_tokens'),
                total_output_tokens=Sum('output_tokens')
            ).values('project_uuid', 'total_cost', 'total_input_tokens', 'total_output_tokens').order_by('-total_cost')[:30]
            project_uuids = [item['project_uuid'] for item in project_usage_query_set]
            projects = Projects.objects.filter(uuid__in=project_uuids)
            project_uuid_name_map = {
                str(project.uuid).replace('-', ''): project.name
                for project in projects
            }
            results = [
                {
                    'project': project_uuid_name_map.get(item['project_uuid'], '<Unknow project>'),
                    'total_cost': item['total_cost'],
                    'total_input_tokens': item['total_input_tokens'],
                    'total_output_tokens': item['total_output_tokens']
                }
                for item in project_usage_query_set
            ]

        return Response({'results': results})
