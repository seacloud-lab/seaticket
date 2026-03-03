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
from seahub.project.db_utils import query_ai_statistics_overview, query_ai_statistics_model, query_ai_statistics_detail
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
                'total_cost': round(item['total_cost'], 8),
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
                'total_cost': round(item['total_cost'], 8),
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
                'total_cost': round(item['total_cost'], 8)
            })

        return Response({'results': results, 'count': total_count})

class OrgAdminAIStatisticsModelsView(APIView):
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
        elif group_by == 'user':
            group_by = 'username'
        elif group_by == 'project':
            group_by = 'project_uuid'
        elif group_by == 'group':
            group_by = 'group_id'
        
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
        
        return Response({'models': query_ai_statistics_model(group_by, condition)})

class OrgAdminAIStatisticsDetailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

    def get(self, request, org_id):
        org_id = int(org_id)
        if not request.user.org or request.user.org.org_id != org_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        
        view = request.GET.get('view')
        group_by = view
        if view == 'project':
            group_by = 'project_uuid'
        elif view == 'user':
            group_by = 'username'
        elif view != 'date':
            return api_error(status.HTTP_400_BAD_REQUEST, 'view invalid. Must be sub-group_by of "project" or "group" or "date"')

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
        
        query_set = query_ai_statistics_detail(group_by, condition, models)

        if view == 'date':
            results = list(query_set)
        elif view == 'user':
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
                    'total_cost': item['total_cost'],
                    'total_input_tokens': item['total_input_tokens'],
                    'total_output_tokens': item['total_output_tokens']
                })
            results.reverse()
        elif view == 'project':
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
                    'total_cost': item['total_cost'],
                    'total_input_tokens': item['total_input_tokens'],
                    'total_output_tokens': item['total_output_tokens']
                }
                for item in query_set
            ]
            results.reverse()

        return Response({'results': results})
