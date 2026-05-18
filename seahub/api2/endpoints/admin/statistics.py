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
from seahub.project.models import Projects
from seahub.group.utils import group_id_to_name
from seahub.organizations.models import Organization

logger = logging.getLogger(__name__)

def _get_user_nickname_map(usernames):
    if not usernames:
        return {}
    profiles = Profile.objects.filter(user__in=usernames)
    return {p.user: p.nickname for p in profiles}

def _get_group_name_map(group_ids):
    if not group_ids:
        return {}
    return {group_id: group_id_to_name(group_id) for group_id in group_ids}

def _get_org_name_map(org_ids):
    if not org_ids:
        return {}
    orgs = Organization.objects.filter(org_id__in=org_ids)
    return {org.org_id: org.org_name for org in orgs}

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
            records = query_ai_statistics_overview('owner', date_range)

            total_count = records.count()
            stats = records[start:end]
            if not stats:
                return Response({'results': [], 'count': 0})

            usernames = []
            org_ids = []
            for item in stats:
                usernames.append(item['owner'])
                if item.get('org_id', -1) != -1:
                    org_ids.append(item['org_id'])

            nickname_map = _get_user_nickname_map(usernames)
            org_name_map = _get_org_name_map(org_ids)

            results = []
            for item in stats:
                owner = item.get('owner')
                org_id = item.get('org_id')
                results.append({
                    'owner': owner,
                    'nickname': nickname_map.get(owner, email2nickname(owner)),
                    'org_id': org_id,
                    'org_name': org_name_map.get(org_id, ''),
                    'total_credit_used': item['total_credit_used']
                })

            return Response({'results': results, 'count': total_count})

        elif group_by == 'project':
            records = query_ai_statistics_overview('project_uuid', date_range)

            total_count = len(records)
            stats = records[start:end]
            if not stats:
                return Response({'results': [], 'count': total_count})

            project_uuids = []
            all_personal_projects_owners = []
            all_group_projects_group_ids = []
            org_ids = []
            for item in stats:
                project_uuids.append(item['project_uuid'])
                if item['owner'] is not None:
                    all_personal_projects_owners.append(item['owner'])
                if item['group_id'] is not None:
                    all_group_projects_group_ids.append(item['group_id'])
                org_ids.append(item['org_id'])

            # all project's info
            projects = Projects.objects.filter(uuid__in=project_uuids)
            projects_dict = {str(p.uuid).replace('-', ''): p for p in projects}

            # all personal project's owner name
            personal_project_owner_nickname_map = _get_user_nickname_map(all_personal_projects_owners)

            # all group project' group name
            group_project_group_name_map = _get_group_name_map(all_group_projects_group_ids)

            # all org's name
            org_name_map = _get_org_name_map(org_ids)

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
                    if item['owner'] is not None:
                        result['owner'] = item['owner']
                        result['nickname'] = personal_project_owner_nickname_map.get(item['owner'], email2nickname(item['owner']))
                    elif item['group_id'] is not None:
                        result['owner'] = f"{item['group_id']}@seafile_group"
                        result['group_name'] = group_project_group_name_map.get(item['group_id'], item['group_id'])
                result['org_id'] = item.get('org_id', -1)
                result['org_name'] = org_name_map.get(result['org_id'], '')
                results.append(result)

            return Response({'results': results, 'count': total_count})

        elif group_by == 'group':
            records = query_ai_statistics_overview('group_id', date_range)

            total_count = len(records)
            stats = records[start:end]
            if not stats:
                return Response({'results': [], 'count': total_count})
            
            group_ids = []
            org_ids = []
            for item in stats:
                group_ids.append(item['group_id'])
                org_ids.append(item['org_id'])
            groups = Group.objects.filter(group_id__in=group_ids)
            group_id_to_name_map = {}
            group_id_to_creator_map = {}
            for g in groups:
                group_id_to_name_map[g.group_id] = g.group_name
                group_id_to_creator_map[g.group_id] = g.creator_name

            nickname_map = _get_user_nickname_map(set(group_id_to_creator_map.values()))

            org_name_map = _get_org_name_map(org_ids)

            results = []
            for item in stats:
                creator = group_id_to_creator_map.get(item['group_id'], '')
                org_id = item.get('org_id', -1)
                results.append({
                    'group_id': item['group_id'],
                    'group_name': group_id_to_name_map.get(item['group_id'], ''),
                    'creator': creator,
                    'creator_name': nickname_map.get(creator, email2nickname(creator)),
                    'total_credit_used': item['total_credit_used'],
                    'org_id': org_id,
                    'org_name': org_name_map.get(org_id, '')
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

            nickname_map = _get_user_nickname_map(set(org_creators))

            results = []
            for item in stats:
                org_id = item['org_id']
                org = org_dict.get(org_id)
                creator = org.creator if org else ''
                results.append({
                    'org_id': org_id,
                    'org_name': org.org_name if org else '',
                    'creator': creator,
                    'creator_name': nickname_map.get(creator, email2nickname(creator)),
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
            group_by = 'owner'
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
        elif group_by == 'owner':
            query_set = query_set[:30]
            owners = [item['owner'] for item in query_set]
            nickname_map = _get_user_nickname_map(owners)
            results = []
            for item in query_set:
                nickname = nickname_map.get(item['username'], email2nickname(item['username']))
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
