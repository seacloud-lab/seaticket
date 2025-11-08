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
from seahub.project.models import StatsAIByProject, Projects


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
        if group_by not in ('owner', 'project_uuid'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be "owner" or "project_uuid"')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page

        group_values, query_values = [], []
        if group_by == 'project_uuid':
            group_values.extend(['project_uuid'])
            query_values.extend(['project_uuid', 'org_id', 'owner', 'total_cost'])
        elif group_by == 'owner':
            group_values.extend(['owner'])
            query_values.extend(['org_id', 'owner', 'total_cost'])

        queryset = StatsAIByProject.objects.filter(date_query).filter(org_id=org_id).values(*group_values).annotate(
            total_cost=Sum('cost')
        ).order_by('-total_cost').values(*query_values)

        stats = list(queryset[start:end])

        # Collect usernames, project_uuids, and group_ids for enrichment
        usernames, project_uuids, group_ids = [], [], []
        for item in stats:
            owner = item.get('owner')
            if owner:
                if '@seafile_group' in owner:
                    group_id = owner.split('@')[0]
                    group_ids.append(int(group_id))
                else:
                    usernames.append(owner)

            project_uuid = item.get('project_uuid')
            if project_uuid:
                project_uuids.append(project_uuid)

        # Get user nicknames
        profiles_dict = {}
        if usernames:
            profiles = Profile.objects.filter(user__in=usernames)
            profiles_dict = {p.user: p.nickname for p in profiles}

        # Get project info
        projects_dict = {}
        if project_uuids:
            projects = Projects.objects.filter(uuid__in=project_uuids)
            for p in projects:
                uuid_with_hyphen = str(p.uuid)
                uuid_without_hyphen = uuid_with_hyphen.replace('-', '')
                projects_dict[uuid_with_hyphen] = p
                projects_dict[uuid_without_hyphen] = p

        # Get group names
        groups_dict = {}
        if group_ids:
            groups = Group.objects.filter(group_id__in=group_ids)
            groups_dict = {g.group_id: g.group_name for g in groups}

        for item in stats:
            item['org_name'] = request.user.org.org_name

            owner = item.get('owner')
            if owner:
                if '@seafile_group' in owner:
                    group_id = int(owner.split('@')[0])
                    item['group_name'] = groups_dict.get(group_id, f'Group {group_id}')
                else:
                    item['nickname'] = profiles_dict.get(owner, '')

            item['total_cost'] = round(item['total_cost'], 2)

            project_uuid = item.get('project_uuid')
            if project_uuid and project_uuid in projects_dict:
                project = projects_dict[project_uuid]
                item['project_name'] = project.name
        return Response({
            'results': stats,
            'count': queryset.count(),
        })
