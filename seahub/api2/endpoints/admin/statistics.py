# -*- coding: utf-8 -*-
import datetime
import calendar
import logging
import json

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
from seahub.project.db_utils import query_ai_statistics_overview, query_ai_statistics_detail
from seahub.project.models import Projects, Workspaces
from seahub.group.utils import group_id_to_name
from seahub.organizations.models import Organization

logger = logging.getLogger(__name__)


class AdminAIStatisticsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
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
        if group_by not in ('user', 'project', 'group', 'org'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be "user", "project", "group" or "org"')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page

        if group_by == 'user':
            records = query_ai_statistics_overview('username', date_range)

            total_count = records.count()
            stats = records[start:end]
            if not stats:
                return Response({'results': [], 'count': 0})

            usernames = [i['username'] for i in stats]
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
                org_id = item.get('org_id')
                results.append({
                    'username': username,
                    'nickname': profiles_dict.get(username, email2nickname(username)),
                    'org_id': org_id,
                    'org_name': org_dict.get(org_id, ''),
                    'total_credit_used': item['total_credit_used']
                })

            return Response({'results': results, 'count': total_count})

        elif group_by == 'project':
            records = query_ai_statistics_overview('project_uuid', date_range)

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
                result['org_id'] = item.get('org_id', -1)
                result['org_name'] = org_dict.get(item.get('org_id', -1), ''),
                results.append(result)

            return Response({'results': results, 'count': total_count})

        elif group_by == 'group':
            records = query_ai_statistics_overview('group_id', date_range)

            total_count = len(records)
            stats = records[start:end]
            if not stats:
                return Response({'results': [], 'count': total_count})
            
            group_ids = [item['group_id'] for item in stats]
            groups = Group.objects.filter(group_id__in=group_ids)
            group_id_to_name_map = {}
            group_id_to_creator_map = {}
            for g in groups:
                group_id_to_name_map[g.group_id] = g.group_name
                group_id_to_creator_map[g.group_id] = g.creator_name
            profiles = Profile.objects.filter(user__in=set(group_id_to_creator_map.values()))
            profiles_dict = {p.user: p.nickname for p in profiles}

            org_ids = [item['org_id'] for item in stats if item['org_id'] != -1]
            orgs = Organization.objects.filter(org_id__in=org_ids)
            org_dict = {org.org_id: org.org_name for org in orgs}

            results = []
            for item in stats:
                creator = group_id_to_creator_map.get(item['group_id'], '')
                results.append({
                    'group_id': item['group_id'],
                    'group_name': group_id_to_name_map.get(item['group_id'], ''),
                    'creator': creator,
                    'creator_name': profiles_dict.get(creator, email2nickname(creator)),
                    'total_credit_used': item['total_credit_used'],
                    'org_id': item['org_id'],
                    'org_name': org_dict.get(item['org_id'], '')
                })

            return Response({'results': results, 'count': total_count})
        
        elif group_by == 'org':
            records = query_ai_statistics_overview('org_id', date_range)

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
                    'total_credit_used': item['total_credit_used']
                })

            return Response({'results': results, 'count': total_count})

class AdminAIStatisticsDetailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
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

        group_by = request.GET.get('group_by')
        if group_by == 'project':
            group_by = 'project_uuid'
        elif group_by == 'user':
            group_by = 'username'
        elif group_by != 'date':
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be sub-group_by of "project" or "group" or "org" or "date"')
        
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
            profiles_dict = {}
            if usernames:
                profiles = Profile.objects.filter(user__in=usernames)
                profiles_dict = {p.user: p.nickname for p in profiles}
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
