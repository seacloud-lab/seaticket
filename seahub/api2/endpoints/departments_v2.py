import logging
from collections import defaultdict

from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.department_v2.models import DepartmentMembersV2, DepartmentsV2, DepartmentV2Groups
from seahub.dtable.models import DTables
from seahub.profile.models import Profile
from seahub.utils import is_org_context

logger = logging.getLogger(__name__)


class AddressBookV2UserDepartmentsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @staticmethod
    def get_department_trees_info(department_trees):
        department_ids_set = set()

        def get_department_tree_info(deparment_tree):
            if deparment_tree.id in department_ids_set:
                return None
            department_tree_info = deparment_tree.to_dict()
            department_ids_set.add(deparment_tree.id)
            department_tree_info['sub_departments'] = []
            for sub_department in deparment_tree.sub_departments:
                department_tree_info['sub_departments'].append(get_department_tree_info(sub_department))
            return department_tree_info

        department_tree_infos = []
        for department_tree in department_trees:
            department_tree_info = get_department_tree_info(department_tree)
            if not department_tree_info:
                continue
            department_tree_infos.append(department_tree_info)
        return department_tree_infos

    def get(self, request):
        username = request.user.username
        departments = DepartmentMembersV2.objects.get_user_departments(username)
        department_trees = [DepartmentsV2.objects.get_deparment_tree(department) for department in departments]
        department_trees_info = self.get_department_trees_info(department_trees)
        return Response({'department_list': department_trees_info})


class AddressBookV2Departments(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        # for select user from departments, so all users can access all departments
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id
        departments = DepartmentsV2.objects.filter(org_id=org_id).order_by('id')
        department_infos = [department.to_dict() for department in departments]
        return Response({'departments': department_infos})


class AddressBookV2SubDepartmentsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, department_id):
        # resource check
        department = DepartmentsV2.objects.filter(id=department_id).first()
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department not found')
        # permission check
        # for select user from departments, all users can access all departments and members
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id
        if org_id != department.org_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        sub_departments = DepartmentsV2.objects.get_sub_departments(department_id)
        return Response({
            'department_list': [d.to_dict() for d in sub_departments]
        })


class AddressBookV2DepartmentMembersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, department_id):
        # resource check
        department = DepartmentsV2.objects.filter(id=department_id).first()
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department not found')
        # permission check
        # for select user from departments, all users can access all departments and members
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id
        if org_id != department.org_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        members = DepartmentMembersV2.objects.get_department_members_by_id(department_id)
        username_member_dict = {member.username: member for member in members}
        user_infos = list(Profile.objects.filter(user__in=username_member_dict.keys()).values('user', 'nickname', 'contact_email'))
        user_list = []
        for user_info in user_infos:
            avatar_url = api_avatar_url(user_info['user'])[0]
            user_list.append({
                'email': user_info['user'],
                'name': user_info['nickname'],
                'contact_email': user_info['contact_email'],
                'avatar_url': avatar_url,
                'is_staff': username_member_dict[user_info['user']].is_staff
            })
        return Response({
            'member_list': user_list
        })


class AddressBookV2DepartmentMemberDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, department_id, email):
        # resource check
        department = DepartmentsV2.objects.filter(id=department_id).first()
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department not found')
        # resource and permission check
        username = request.user.username
        if not DepartmentMembersV2.objects.is_user_in_department_by_id(email, department_id):
            return api_error(status.HTTP_404_NOT_FOUND, 'User is not in department %s' % department.name)
        if not DepartmentMembersV2.objects.can_user_access_department_member_dtables(username, department):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        dtables = DTables.objects.get_personal_dtables_by_username(email) or []
        dtable_info_list = [d.to_dict() for d in dtables]
        return Response({
            'dtable_list': dtable_info_list
        })


class AddressBookV2DepartmentGroupMembersCountView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, group_id):
        # check group
        group = DepartmentV2Groups.objects.filter(group_id=group_id).select_related('department').first()
        if not group:
            return api_error(status.HTTP_400_BAD_REQUEST, 'It is not a department group')
        # permission check
        # for select user from departments, all users can access all departments and members
        # so all users can access members of all department groups
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id
        if org_id != group.department.org_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        usernames_set = set(DepartmentMembersV2.objects.get_department_members(group.department.id).values_list('username', flat=True))
        usernames_set |= set(DepartmentMembersV2.objects.get_all_sub_departments_members(group.department).values_list('username', flat=True))
        return Response({'count': len(usernames_set)})
