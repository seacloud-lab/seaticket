# -*- coding: utf-8 -*-
import datetime
import calendar
import logging
import json

from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.profile.models import Profile
from seahub.group.models import Group
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.project.models import AIUsageStatistics, Projects, Workspaces
from seahub.group.utils import group_id_to_name
from seahub.organizations.models import Organization

logger = logging.getLogger(__name__)


class AdminAIStatisticsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def _query_data(self, group_by, date_query):
        org_condition = ''
        if group_by == 'org_id':
            org_condition = ' AND `org_id` != -1'
        sql = f"""
            SELECT 
                `id`,
                `{group_by}`,
                `org_id`,
                SUM(`cost`) as `total_cost`,
                GROUP_CONCAT(`model`) as `model_list`
            FROM `ai_usage_statistics`
            WHERE {date_query}{org_condition}
            GROUP BY `{group_by}` ORDER BY `total_cost` DESC
        """
        queryset = AIUsageStatistics.objects.raw(sql)
        records = []
        for item in queryset:
            record = {
                'total_cost': item.total_cost,
                'model_list': item.model_list.split(','),
                'org_id': item.org_id
            }
            if group_by == 'project_uuid':
                record['project_uuid'] = item.project_uuid
            elif group_by == 'username':
                record['username'] = item.username
            records.append(record)
        return records

    def get(self, request):
        date = request.GET.get('date')
        month = request.GET.get('month')

        if not date and not month:
            return api_error(status.HTTP_400_BAD_REQUEST, 'date or month required')
        if date:
            try:
                date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
                date_query = f'`date` = "{date.isoformat()}"'
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'date invalid')
        elif month:
            try:
                start_date = datetime.datetime.strptime(month, '%Y%m').date()
                _, last_day_num = calendar.monthrange(start_date.year, start_date.month)
                end_date = datetime.date(start_date.year, start_date.month, last_day_num)
                date_query = f'`date` >= "{start_date.isoformat()}" and `date` <= "{end_date.isoformat()}"'
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid')

        group_by = request.GET.get('group_by', 'user')
        if group_by not in ('user', 'project', 'group', 'org'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be "user", "project", "group" or "org"')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page

        if group_by == 'user':
            records = self._query_data('username', date_query)

            total_count = len(records)
            stats = records[start:end]
            if not stats:
                return Response({'results': [], 'count': 0})

            usernames = [i['username'] for i in stats if i['username'] and i['username'] != 'seaqa-indexer']
            profiles_dict = {}
            if usernames:
                profiles = Profile.objects.filter(user__in=usernames)
                profiles_dict = {p.user: p.nickname for p in profiles}

            org_ids = [i['org_id'] for i in stats if i.get('org_id', -1) != -1]
            org_dict = {}
            if org_ids:
                orgs = Organization.objects.filter(org_id__in=org_ids)
                org_dict = {org.org_id: org.org_name for org in orgs}

            results = []
            for item in stats:
                username = item.get('username')
                if not username or username == 'seaqa-indexer':
                    continue
                org_id = item.get('org_id')
                results.append({
                    'username': username,
                    'nickname': profiles_dict.get(username, email2nickname(username)),
                    'org_id': org_id,
                    'org_name': org_dict.get(org_id, ''),
                    'total_cost': round(item['total_cost'], 2),
                    'model_list': item['model_list']
                })

            return Response({'results': results, 'count': total_count})

        elif group_by == 'project':
            records = self._query_data('project_uuid', date_query)

            total_count = len(records)
            stats = records[start:end]
            if not stats:
                return Response({'results': [], 'count': total_count})

            project_uuids = [item['project_uuid'] for item in stats]
            projects = Projects.objects.filter(uuid__in=project_uuids)
            projects_dict = {str(p.uuid).replace('-', ''): p for p in projects}

            workspace_ids = [p.workspace_id for p in projects]
            workspaces = Workspaces.objects.filter(id__in=workspace_ids)

            org_ids = [i['org_id'] for i in stats if i.get('org_id', -1) != -1]
            org_dict = {}
            if org_ids:
                orgs = Organization.objects.filter(org_id__in=org_ids)
                org_dict = {org.org_id: org.org_name for org in orgs}

            usernames = [w.owner for w in workspaces if '@seafile_group' not in w.owner]
            profiles = Profile.objects.filter(user__in=set(usernames))
            profiles_dict = {p.user: p.nickname for p in profiles}

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
                result['org_id'] = item.get('org_id', -1)
                result['org_name'] = org_dict.get(item.get('org_id', -1), ''),
                results.append(result)

            return Response({'results': results, 'count': total_count})

        elif group_by == 'group':
            records = self._query_data('project_uuid', date_query)
            if not records:
                return Response({'results': [], 'count': 0})

            project_uuid_stats_map = {
                item['project_uuid']: {
                    'total_cost': item['total_cost'],
                    'org_id': item['org_id'],
                    'model_list': item['model_list']
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

            group_id_stats_map = {}
            for w in workspaces:
                if '@seafile_group' in w.owner:
                    group_id = int(w.owner.split('@')[0])
                    project_uuids = workspace_project_uuids_map[w.id]
                    group_id_stats_map[group_id] = {
                        'org_id': w.org_id,
                        'model_list': set(),
                        'total_cost': 0
                    }
                    for p_uuid, st in group_id_stats_map.items():
                        if p_uuid in project_uuids:
                            group_id_stats_map[group_id]['model_list'].update(st['model_list'])
                            group_id_stats_map[group_id]['total_cost'] += st['total_cost']

            if not group_id_stats_map:
                return Response({'results': [], 'count': 0})

            sorted_group_stats = sorted(group_id_stats_map.items(), key=lambda x: x[1]['total_cost'], reverse=True)
            total_count = len(sorted_group_stats)
            paged_group_stats = sorted_group_stats[start:end]

            relative_org_ids = []
            relative_group_ids = []
            for (group_id, stats) in paged_group_stats:
                relative_group_ids.append(group_id)
                if stats['org_id'] != -1:
                    relative_org_ids.append(stats['org_id'])
            
            relative_org_dict = {}
            if relative_org_ids:
                orgs = Organization.objects.filter(org_id__in=relative_org_ids)
                relative_org_dict = {org.org_id: org.org_name for org in orgs}
            
            groups = Group.objects.filter(group_id__in=relative_group_ids)
            group_id_to_name_map = {}
            group_id_to_creator_map = {}
            for g in groups:
                group_id_to_name_map[g.group_id] = g.group_name
                group_id_to_creator_map[g.group_id] = g.creator_name
            profiles = Profile.objects.filter(user__in=set(group_id_to_creator_map.values()))
            profiles_dict = {p.user: p.nickname for p in profiles}

            results = []
            for (group_id, stats) in paged_group_stats:
                creator = group_id_to_creator_map.get(group_id, '')
                results.append({
                    'group_id': group_id,
                    'group_name': group_id_to_name_map.get(group_id, ''),
                    'creator': creator,
                    'creator_name': profiles_dict.get(creator, email2nickname(creator)),
                    'total_cost': round(stats['total_cost'], 2),
                    'org_id': stats['org_id'],
                    'org_name': relative_org_dict.get(stats['org_id'], ''),
                    'model_list': stats['model_list']
                })

            return Response({'results': results, 'count': total_count})
        
        elif group_by == 'org':
            records = self._query_data('org_id', date_query)

            total_count = len(records)
            stats = records[start:end]
            if not stats:
                return Response({'results': [], 'count': 0})

            org_ids = [i['org_id'] for i in stats]
            org_dict = {}
            org_creators = []
            if org_ids:
                orgs = Organization.objects.filter(org_id__in=org_ids)
                for org in orgs:
                    org_dict[org.org_id] = org
                    org_creators.append(org.creator)
            profiles = Profile.objects.filter(user__in=set(org_creators))
            profiles_dict = {p.user: p.nickname for p in profiles}

            results = []
            for item in stats:
                org_id = item['org_id']
                org = org_dict.get(org_id)
                creator = org.creator if org else ''
                results.append({
                    'org_id': org_id,
                    'org_name': org.org_name if org else '',
                    'creator': creator,
                    'creator_name': profiles_dict.get(creator, email2nickname(creator)),
                    'total_cost': round(item['total_cost'], 2),
                    'model_list': item['model_list']
                })

            return Response({'results': results, 'count': total_count})

class AdminAIStatisticsDetailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        group_by = request.GET.get('group_by')
        if group_by not in ('user', 'project', 'group', 'org'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be "user", "project", "group" or "org"')

        condition = request.GET.get('condition')
        if not condition:
            return api_error(status.HTTP_400_BAD_REQUEST, 'condition invalid')
        
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
        
        if group_by == 'group':
            # 1. get workspace id
            owner = f'{condition}@seafile_group'
            workspace = Workspaces.objects.filter(owner=owner).first()
            if not workspace:
                return api_error(status.HTTP_404_NOT_FOUND, 'Workspace not found')
            
            # 2. get projects belong to this group (group workspace)
            project_uuids = Projects.objects.filter(workspace_id=workspace.pk).values_list('uuid', flat=True)
        
        # get usage detail
        query_args = {'model__in': models}
        if group_by == 'user':
            query_args['username'] = condition
        elif group_by == 'project':
            query_args['project_uuid'] = condition.replace('-', '')
        elif group_by == 'group':
            query_args['project_uuid__in'] = project_uuids
        elif group_by == 'org':
            query_args['org_id'] = condition

        base_queryset = AIUsageStatistics.objects.filter(**query_args).values('date').annotate(
            total_cost=Sum('cost'),
            total_input_tokens=Sum('input_tokens'),
            total_output_tokens=Sum('output_tokens')
        ).values('date', 'total_cost', 'total_input_tokens', 'total_output_tokens')
        return Response({'results': list(base_queryset)})
