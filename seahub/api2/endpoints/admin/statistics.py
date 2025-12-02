# -*- coding: utf-8 -*-
import datetime
import calendar
import logging

from django.db.models import Sum, Q
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
from seahub.project.models import StatsAIByProject, Projects, Workspaces
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
                date_query = Q(date=date)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'date invalid')
        else:  # month
            try:
                start_date = datetime.datetime.strptime(month, '%Y%m').date()
                _, last_day_num = calendar.monthrange(start_date.year, start_date.month)
                end_date = datetime.date(start_date.year, start_date.month, last_day_num)
                date_query = Q(date__gte=start_date) & Q(date__lte=end_date)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid')

        group_by = request.GET.get('group_by', 'owner')
        if group_by not in ('owner', 'org_id', 'workspace'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be "owner" or "org_id" or "workspace"')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page

        base_queryset = StatsAIByProject.objects.filter(date_query)

        if group_by == 'owner':
            queryset = base_queryset.values('username').annotate(
                total_cost=Sum('cost')
            ).order_by('-total_cost').values('username', 'org_id', 'total_cost')

            stats = list(queryset[start:end])
            if not stats:
                return Response({'results': [], 'count': 0})

            usernames = [i['username'] for i in stats if i['username'] and i['username'] != 'seaqa-indexer']
            total_count = len(usernames)
            profiles_dict = {}
            if usernames:
                profiles = Profile.objects.filter(user__in=usernames)
                profiles_dict = {p.user: p.nickname for p in profiles}

            org_ids = [i['org_id'] for i in stats if i.get('org_id') and i['org_id'] != -1]
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
                    'owner': username,
                    'nickname': profiles_dict.get(username, email2nickname(username)),
                    'org_id': org_id,
                    'org_name': org_dict.get(org_id, ''),
                    'total_cost': round(item['total_cost'], 2),
                })

            return Response({'results': results, 'count': total_count})

        elif group_by == 'org_id':
            queryset = base_queryset.values('org_id').annotate(
                total_cost=Sum('cost')
            ).order_by('-total_cost').values('org_id', 'total_cost')

            total_count = queryset.count()
            stats = list(queryset[start:end])
            if not stats:
                return Response({'results': [], 'count': 0})

            org_ids = [i['org_id'] for i in stats if i.get('org_id') and i['org_id'] != -1]
            org_dict = {}
            if org_ids:
                orgs = Organization.objects.filter(org_id__in=org_ids)
                org_dict = {org.org_id: org.org_name for org in orgs}

            for item in stats:
                org_id = item.get('org_id')
                item['org_name'] = org_dict.get(org_id, '')
                item['total_cost'] = round(item['total_cost'], 2)

            return Response({'results': stats, 'count': total_count})

        elif group_by == 'workspace':
            queryset = base_queryset.values('project_uuid').annotate(
                total_cost=Sum('cost')
            ).order_by('-total_cost').values('project_uuid', 'org_id', 'total_cost')

            project_stats = list(queryset)
            if not project_stats:
                return Response({'results': [], 'count': 0})

            # project_uuid -> workspace_id
            project_uuids = [item['project_uuid'] for item in project_stats]
            projects = Projects.objects.filter(uuid__in=project_uuids).only('uuid', 'workspace_id')
            project_workspace_map = {str(p.uuid).replace('-', ''): p.workspace_id for p in projects}

            # org_id -> org_name
            org_ids = [i['org_id'] for i in project_stats if i.get('org_id') and i['org_id'] != -1]
            org_dict = {}
            if org_ids:
                orgs = Organization.objects.filter(org_id__in=org_ids)
                org_dict = {org.org_id: org.org_name for org in orgs}

            workspace_totals = {}
            for item in project_stats:
                ws_id = project_workspace_map.get(item['project_uuid'])
                if not ws_id:
                    continue
                workspace_totals[ws_id] = workspace_totals.get(ws_id, 0.0) + float(item['total_cost'] or 0)

            if not workspace_totals:
                return Response({'results': [], 'count': 0})

            # build workspace meta in batch (name/owner/org_id)
            workspaces = list(Workspaces.objects.filter(id__in=workspace_totals.keys()).only('id', 'owner', 'org_id'))
            # collect group ids once
            group_ids = [int(w.owner.split('@')[0]) for w in workspaces if '@seafile_group' in w.owner]
            group_name_map = {}
            if group_ids:
                groups = Group.objects.filter(group_id__in=group_ids)
                group_name_map = {g.group_id: g.group_name for g in groups}

            workspace_meta = {}
            for w in workspaces:
                owner = w.owner
                if '@seafile_group' in owner:
                    gid = int(owner.split('@')[0])
                    ws_name = group_name_map.get(gid, group_id_to_name(gid))
                else:
                    ws_name = email2nickname(owner)
                workspace_meta[w.id] = {
                    'owner': owner,
                    'org_id': w.org_id,
                    'workspace_name': ws_name,
                }

            # sorted and paged
            sorted_items = sorted(workspace_totals.items(), key=lambda x: x[1], reverse=True)
            total_count = len(sorted_items)
            paged_items = sorted_items[start:end]
            results = []
            for ws_id, total in paged_items:
                meta = workspace_meta.get(ws_id, {})
                org_id = meta.get('org_id', -1)
                results.append({
                    'workspace_id': ws_id,
                    'workspace_name': meta.get('workspace_name', ''),
                    'owner': meta.get('owner', ''),
                    'org_id': org_id,
                    'org_name': org_dict.get(org_id, ''),
                    'total_cost': round(total, 2),
                })

            return Response({'results': results, 'count': total_count})
