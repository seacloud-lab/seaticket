# -*- coding: utf-8 -*-
import datetime
import calendar

from django.db.models import Sum, Q
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
from seahub.project.models import StatsAIByProject, Projects, Workspaces
from seahub.group.utils import group_id_to_name


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
                date_query = Q(date=date)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'date invalid')
        elif month:
            try:
                start_date = datetime.datetime.strptime(month, '%Y%m').date()
                _, last_day_num = calendar.monthrange(start_date.year, start_date.month)
                end_date = datetime.date(start_date.year, start_date.month, last_day_num)
                date_query = Q(date__gte=start_date) & Q(date__lte=end_date)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid')

        group_by = request.GET.get('group_by', 'owner')
        if group_by not in ('owner', 'project', 'workspace'):
            return api_error(status.HTTP_400_BAD_REQUEST,
                             'group_by invalid. Must be "owner" or "project" or "workspace"')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page

        org_name = request.user.org.org_name
        base_queryset = StatsAIByProject.objects.filter(date_query).filter(org_id=org_id)
        if group_by == 'project':
            return self._stats_by_project(base_queryset, org_id, org_name, start, end)
        elif group_by == 'owner':
            return self._stats_by_owner(base_queryset, org_id, org_name, start, end)
        elif group_by == 'workspace':
            return self._stats_by_workspace(base_queryset, org_id, org_name, start, end)


    def _get_profiles_dict(self, usernames):
        if not usernames:
            return {}
        profiles = Profile.objects.filter(user__in=usernames)
        return {p.user: p.nickname for p in profiles}

    def _stats_by_project(self, base_queryset, org_id, org_name, start, end):
        queryset = base_queryset.values('project_uuid').annotate(
            total_cost=Sum('cost')
        ).order_by('-total_cost').values('project_uuid', 'org_id', 'total_cost')

        total_count = queryset.count()
        stats = list(queryset[start:end])
        if not stats:
            return Response({'results': [], 'count': 0})

        project_uuids = [item['project_uuid'] for item in stats]
        projects = Projects.objects.filter(uuid__in=project_uuids)
        projects_dict = {str(p.uuid).replace('-', ''): p for p in projects}

        workspace_ids = [p.workspace_id for p in projects]
        workspaces = Workspaces.objects.filter(id__in=workspace_ids)

        usernames = [w.owner for w in workspaces if '@seafile_group' not in w.owner]
        profiles_dict = self._get_profiles_dict(usernames)

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
                'org_id': org_id,
                'org_name': org_name,
                'total_cost': round(item['total_cost'], 2),
                'project_name': project.name if project else None,
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

    def _stats_by_owner(self, base_queryset, org_id, org_name, start, end):
        queryset = base_queryset.values('project_uuid').annotate(
            total_cost=Sum('cost')
        ).order_by('-total_cost').values('project_uuid', 'org_id', 'username', 'total_cost')

        total_count = queryset.count()
        stats = list(queryset[start:end])
        if not stats:
            return Response({'results': [], 'count': 0})

        usernames = set()
        project_uuids = []
        for item in stats:
            if item['username'] != 'seaqa-indexer':
                usernames.add(item['username'])
            project_uuids.append(item['project_uuid'])

        profiles_dict = self._get_profiles_dict(list(usernames))
        projects = Projects.objects.filter(uuid__in=project_uuids)
        projects_dict = {str(p.uuid).replace('-', ''): p for p in projects}

        results = []
        for item in stats:
            if item['username'] == 'seaqa-indexer':
                continue
            owner = item['username']
            project = projects_dict.get(item['project_uuid'])
            results.append({
                'project_uuid': item['project_uuid'],
                'org_id': org_id,
                'org_name': org_name,
                'total_cost': round(item['total_cost'], 2),
                'owner': owner,
                'nickname': profiles_dict.get(owner, ''),
                'project_name': project.name if project else None,
            })

        return Response({'results': results, 'count': total_count})

    def _stats_by_workspace(self, base_queryset, org_id, org_name, start, end):
        queryset = base_queryset.values('project_uuid').annotate(
            total_cost=Sum('cost')
        ).order_by('-total_cost').values('project_uuid', 'org_id', 'total_cost')

        total_count = queryset.count()
        stats = list(queryset[start:end])
        if not stats:
            return Response({'results': [], 'count': 0})

        stats_dict = {item['project_uuid']: item for item in stats}
        project_uuids = list(stats_dict.keys())

        projects = Projects.objects.filter(uuid__in=project_uuids)
        project_workspace_map = {str(p.uuid).replace('-', ''): p.workspace_id for p in projects}

        workspace_ids = set(project_workspace_map.values())
        workspaces = Workspaces.objects.filter(id__in=workspace_ids)

        usernames = [w.owner for w in workspaces if '@seafile_group' not in w.owner]
        profiles_dict = self._get_profiles_dict(usernames)

        workspace_info = {}
        for w in workspaces:
            if '@seafile_group' in w.owner:
                group_id = int(w.owner.split('@')[0])
                group_name = group_id_to_name(group_id)
                workspace_info[w.id] = {
                    'owner': w.owner,
                    'group_name': group_name,
                    'workspace_name': group_name,
                }
            else:
                workspace_info[w.id] = {
                    'owner': w.owner,
                    'nickname': profiles_dict.get(w.owner, ''),
                    'workspace_name': 'personal',
                }

        results = []
        for project_uuid, stat in stats_dict.items():
            workspace_id = project_workspace_map.get(project_uuid)
            if not workspace_id:
                continue
            ws_info = workspace_info.get(workspace_id, {})
            result = {
                'project_uuid': project_uuid,
                'org_id': org_id,
                'org_name': org_name,
                'total_cost': round(stat['total_cost'], 2),
                'owner': ws_info.get('owner'),
                'workspace_name': ws_info.get('workspace_name'),
            }
            if 'group_name' in ws_info:
                result['group_name'] = ws_info['group_name']
            else:
                result['nickname'] = ws_info.get('nickname', '')
            results.append(result)

        return Response({'results': results, 'count': total_count})
