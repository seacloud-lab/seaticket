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
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not request.user.org or request.user.org.org_id != org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
        if group_by not in ('owner', 'project_uuid', 'workspace'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be "owner" or "project_uuid" or "workspace"')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page
        org_name = request.user.org.org_name
        org_id = request.user.org.org_id
        group_values, query_values = [], []
        if group_by == 'project_uuid':
            queryset = StatsAIByProject.objects.filter(date_query).filter(org_id=org_id).values('project_uuid').annotate(
                total_cost=Sum('cost')
            ).order_by('-total_cost').values('project_uuid', 'org_id', 'total_cost')
            stats = list(queryset[start:end])
            project_uuids = [item['project_uuid'] for item in stats]
            projects = Projects.objects.filter(uuid__in=project_uuids)
            projects_dict = {str(p.uuid).replace('-', ''): p for p in projects}
            workspace_ids = [item.workspace_id for item in projects]
            workspaces = Workspaces.objects.filter(id__in=workspace_ids)
            group_name_dict = {}
            username_dict = {}
            usernames = []
            for workspace in workspaces:
                owner = workspace.owner
                if '@seafile_group' in owner:
                    group_id = int(owner.split('@')[0])
                    group_name = group_id_to_name(group_id)
                    group_name_dict[workspace.id] = group_name
                else:
                    username_dict[workspace.id] = owner
                usernames.append(owner)
            project_group_name = {}
            project_username = {}
            for project in projects:
                workspace_id = project.workspace_id
                if workspace_id in group_name_dict:
                    project_group_name[str(project.uuid).replace('-', '')] = group_name_dict[workspace_id]
                else:
                    project_username[str(project.uuid).replace('-', '')] = username_dict[workspace_id]
            profiles = Profile.objects.filter(user__in=usernames)
            profiles_dict = {p.user: p.nickname for p in profiles}

            for item in stats:
                item['org_id'] = org_id
                item['org_name'] = org_name
                project_uuid = item['project_uuid']
                owner = project_username.get(project_uuid)
                if project_uuid in project_group_name:
                    item['group_name'] = project_group_name[project_uuid]
                else:
                    item['nickname'] = profiles_dict.get(owner, '')
                item['total_cost'] = round(item['total_cost'], 2)
                item['owner'] = owner
                project = projects_dict.get(item['project_uuid'], None)
                if project:
                    item['project_name'] = project.name

        elif group_by == 'owner':
            queryset = StatsAIByProject.objects.filter(date_query).filter(org_id=org_id).values('project_uuid').annotate(
                total_cost=Sum('cost')
            ).order_by('-total_cost').values('project_uuid', 'org_id', 'username', 'total_cost')
            stats = list(queryset[start:end])
            usernames = [item['username'] for item in stats if item['username'] != 'seaqa-indexer']
            project_uuids = [item['project_uuid'] for item in stats]
            results = []
            for item in stats:
                if item['username'] == 'seaqa-indexer':
                    continue
                item['org_id'] = org_id
                item['org_name'] = org_name
                project_uuid = item['project_uuid']
                owner = item['username']
                item['total_cost'] = round(item['total_cost'], 2)
                item['owner'] = owner
                profiles = Profile.objects.filter(user__in=usernames)
                profiles_dict = {p.user: p.nickname for p in profiles}
                item['nickname'] = profiles_dict.get(owner, '')
                projects = Projects.objects.filter(uuid__in=project_uuids)
                projects_dict = {str(p.uuid).replace('-', ''): p for p in projects}
                project = projects_dict.get(item['project_uuid'], None)
                if project:
                    item['project_name'] = project.name
                results.append(item)
                return Response({
                        'results': results,
                        'count': queryset.count(),
                    })
        elif group_by == 'workspace':
            queryset = StatsAIByProject.objects.filter(date_query).filter(org_id=org_id).values('project_uuid').annotate(
                total_cost=Sum('cost')
            ).order_by('-total_cost').values('project_uuid', 'org_id', 'total_cost')
            stats = list(queryset[start:end])
            workspace_id_project_uuids_map = {}
            workspaces = Workspaces.objects.filter(org_id=org_id)
            workspace_ids = [w.id for w in workspaces]
            workspace_id_owner_map = {}
            for workspace in workspaces:
                workspace_id_owner_map[workspace.id] = workspace.owner
            workspace_id_name_map = {}
            usernames = [workspace.owner for workspace in workspaces]
            profiles = Profile.objects.filter(user__in=usernames)
            profiles_dict = {p.user: p.nickname for p in profiles}
            for workspace in workspaces:
                if '@seafile_group' in workspace.owner:
                    group_id = workspace.owner.split('@')[0]
                    workspace_id_name_map[workspace.id] = group_id_to_name(group_id)
                else:
                    workspace_id_name_map[workspace.id] = profiles_dict.get(workspace.owner, '')
            projects = Projects.objects.filter(workspace_id__in=workspace_ids)
            for project in projects:
                project_uuid = str(project.uuid).replace('-', '')
                if project.workspace_id not in workspace_id_project_uuids_map:
                    workspace_id_project_uuids_map[project.workspace_id] = []
                workspace_id_project_uuids_map[project.workspace_id].append(project_uuid)
            
            results = []
            for workspace_id, project_uuids in workspace_id_project_uuids_map.items():
                for item in stats:
                    if item['project_uuid'] in project_uuids:
                        item['org_id'] = org_id
                        item['org_name'] = org_name
                        item['total_cost'] = round(item['total_cost'], 2)
                        item['owner'] = workspace_id_owner_map[workspace_id]
                        if '@seafile_group' in workspace_id_owner_map[workspace_id]:
                            item['group_name'] = workspace_id_name_map[workspace_id]
                            item['workspace_name'] = workspace_id_name_map[workspace_id]
                        else:
                            item['nickname'] = workspace_id_name_map[workspace_id]
                            item['workspace_name'] = 'personal'
                        results.append(item)
            return Response({
                        'results': results,
                        'count': queryset.count(),
                    })

        return Response({
            'results': stats,
            'count': queryset.count(),
        })
