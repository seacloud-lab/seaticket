# -*- coding: utf-8 -*-
import datetime
import logging

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
from seahub.project.models import StatsAIByProject
from seahub.organizations.models import Organization

logger = logging.getLogger(__name__)


class AdminAIStatisticsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        # Get and validate date parameter
        date = request.GET.get('date')
        if not date:
            date = datetime.date.today()
        else:
            try:
                date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'date invalid')

        # Get and validate group_by parameter
        group_by = request.GET.get('group_by', 'owner')
        if group_by not in ('owner', 'org_id'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. Must be "owner" or "org_id"')

        # Get pagination parameters
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25
        start, end = (page - 1) * per_page, page * per_page

        # Query statistics
        group_values, query_values = [], []
        if group_by == 'org_id':
            group_values.extend(['org_id'])
            query_values.extend(['org_id', 'total_cost'])
        elif group_by == 'owner':
            group_values.extend(['owner'])
            query_values.extend(['org_id', 'owner', 'total_cost'])

        queryset = StatsAIByProject.objects.filter(date=date).values(*group_values).annotate(
            total_cost=Sum('cost')
        ).order_by('-total_cost').values(*query_values)

        stats = list(queryset[start:end])

        # Collect usernames, org_ids, and group_ids for enrichment
        usernames, org_ids, group_ids = [], [], []
        for item in stats:
            org_id = item.get('org_id')
            if org_id and org_id != -1:
                org_ids.append(org_id)

            owner = item.get('owner')
            if owner:
                if '@seafile_group' in owner:
                    group_id = owner.split('@')[0]
                    group_ids.append(int(group_id))
                else:
                    usernames.append(owner)

        # Get organization names
        org_dict = {}
        if org_ids:
            orgs = Organization.objects.filter(org_id__in=org_ids)
            org_dict = {org.org_id: org.org_name for org in orgs}

        # Get user nicknames
        profiles_dict = {}
        if usernames:
            profiles = Profile.objects.filter(user__in=usernames)
            profiles_dict = {p.user: p.nickname for p in profiles}

        # Get group names
        groups_dict = {}
        if group_ids:
            groups = Group.objects.filter(group_id__in=group_ids)
            groups_dict = {g.group_id: g.group_name for g in groups}

        # Enrich the data
        for item in stats:
            org_id = item.get('org_id')
            if org_id and org_id != -1:
                item['org_name'] = org_dict.get(org_id, '')

            owner = item.get('owner')
            if owner:
                if '@seafile_group' in owner:
                    group_id = int(owner.split('@')[0])
                    item['group_name'] = groups_dict.get(group_id, f'Group {group_id}')
                else:
                    item['nickname'] = profiles_dict.get(owner, email2nickname(owner))

            item['total_cost'] = round(item['total_cost'], 2)

        return Response({
            'results': stats,
            'count': queryset.count(),
        })
