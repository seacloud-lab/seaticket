from collections import defaultdict

from django.conf import settings

from seaserv import ccnet_api

from seahub.auth.models import AnonymousUser
from seahub.department_v2.models import DepartmentV2Groups, DepartmentMembersV2, DepartmentsV2
from seahub.utils import is_org_context


def get_department_v2_groups_by_user(username, is_staff=None):
    """return a queryset of DepartmentV2Groups

    if a user is in department /A/B/C, as while, it is the member of groups of departments /A, /A/B and /A/B/C
    """
    departments = DepartmentMembersV2.objects.get_user_departments(username, is_staff=is_staff)
    if is_staff is True:
        return DepartmentV2Groups.objects.filter(department__in=departments)
    departments_ids_set = set()
    for department in departments:
        for department_id in DepartmentsV2.objects.get_ancestor_departments_ids(department):
            departments_ids_set.add(department_id)
    return DepartmentV2Groups.objects.filter(department_id__in=departments_ids_set)


def get_department_v2_groups_members(group_ids, only_staffs=False):
    """get group members
    Members of one department group include members of department and members of all sub-departments

    return {'group_1': [a list of {'username': 'xxx', 'is_staff': true/false}],}
    """
    dep_id_2_members_dict = defaultdict(list)
    dep_id_2_members_set_dict = defaultdict(set)
    groups = list(DepartmentV2Groups.objects.filter(group_id__in=group_ids).select_related('department'))
    dep_id_2_group_id_dict = {group.department_id: group.group_id for group in groups}
    # department members
    kwargs = {'department__in': [dep_group.department for dep_group in groups]}
    if only_staffs:
        kwargs['is_staff'] = True
    members = list(DepartmentMembersV2.objects.filter(**kwargs).values('department_id', 'username', 'is_staff'))
    for member in members:
        dep_id_2_members_dict[member['department_id']].append({'username': member['username'], 'is_staff': member['is_staff']})
        dep_id_2_members_set_dict[member['department_id']].add(member['username'])
    if not only_staffs:
        # sub department members
        all_sub_dep_ids = []
        origin_dep_ids_dict = defaultdict(list)  # {some-level-sub-dep-id: [...list of origin dep ids]}
        for department_v2_group in groups:
            department = department_v2_group.department
            sub_department_ids = list(DepartmentsV2.objects.get_all_sub_departments(department).values_list('id', flat=True))
            for sub_department_id in sub_department_ids:
                if department.id not in origin_dep_ids_dict[sub_department_id]:
                    origin_dep_ids_dict[sub_department_id].append(department.id)
                if sub_department_id not in all_sub_dep_ids:
                    all_sub_dep_ids.append(sub_department_id)
        for member in DepartmentMembersV2.objects.filter(department_id__in=all_sub_dep_ids).values('department_id', 'username'):
            member_username = member['username']
            member_department_id = member['department_id']
            origin_dep_ids = origin_dep_ids_dict[member_department_id]
            for origin_dep_id in origin_dep_ids:
                if member_username in dep_id_2_members_set_dict[origin_dep_id]:
                    continue
                dep_id_2_members_dict[origin_dep_id].append({'username': member_username, 'is_staff': False})
                dep_id_2_members_set_dict[origin_dep_id].add(member_username)

    res = {group_id: [] for group_id in group_ids}
    res.update({dep_id_2_group_id_dict[department_id]: members for department_id, members in dep_id_2_members_dict.items()})
    return res


def is_department_v2_group_member(group_id, username):
    """
    user should be in department-group or in one of sub-departments
    """
    group = DepartmentV2Groups.objects.filter(group_id=group_id).select_related('department').first()
    if not group:
        return False
    department = group.department
    user_dep_ids = DepartmentMembersV2.objects.filter(username=username).values_list('department_id', flat=True)
    dep_paths = DepartmentsV2.objects.filter(id__in=user_dep_ids).values_list('path', flat=True)
    prefix = department.path + '/'
    for dep_path in dep_paths:
        if dep_path == department.path:
            return True
        if dep_path.startswith(prefix):
            return True
    return False


def is_department_v2_group_admin(group_id, username):
    group = DepartmentV2Groups.objects.filter(group_id=group_id).first()
    if not group:
        return False
    return DepartmentMembersV2.objects.filter(department_id=group.department_id, username=username, is_staff=True).exists()


def is_department_v2_group(group_id):
    return DepartmentV2Groups.objects.filter(group_id=group_id).exists()


def get_department_and_sub_departments_ids(department):
    department_ids = [department.id]
    sub_departments = DepartmentsV2.objects.get_all_sub_departments(department)
    for department in sub_departments:
        department_ids.append(department.id)
    return department_ids


def get_departments_map_by_username(username, org_id=None):
    departments = DepartmentMembersV2.objects.get_user_departments(username, org_id=org_id)
    current_user_department_ids = []
    current_user_department_and_sub_ids = []
    for department in departments:
        current_user_department_ids.append(department.id)
        dep_ids = get_department_and_sub_departments_ids(department)
        for dep_id in dep_ids:
            if dep_id not in current_user_department_and_sub_ids:
                current_user_department_and_sub_ids.append(dep_id)
    user_department_ids_map = {
        'current_user_department_ids': current_user_department_ids,
        'current_user_department_and_sub_ids': current_user_department_and_sub_ids
    }
    return user_department_ids_map


def get_departments_map_by_request_dtable(request, dtable):
    if isinstance(request.user, AnonymousUser):
        return {
            'current_user_department_ids': [],
            'current_user_department_and_sub_ids': []
        }
    if is_org_context(request):
        org_id = request.user.org.org_id
    else:
        org_id = -1
    dtable_org_id = dtable.workspace.org_id
    if org_id != dtable_org_id:
        return {
            'current_user_department_ids': [],
            'current_user_department_and_sub_ids': []
        }
    return get_departments_map_by_username(request.user.username, org_id=org_id)


def get_departments_map_by_username_dtable(username, dtable):
    if getattr(settings, 'CLOUD_MODE', False):
        org_id = -1
    else:
        orgs = ccnet_api.get_orgs_by_user(username)
        org = orgs[0] if orgs else None
        if not org:
            org_id = -1
        else:
            org_id = org.org_id
    dtable_org_id = dtable.workspace.org_id
    if org_id != dtable_org_id:
        return {
            'current_user_department_ids': [],
            'current_user_department_and_sub_ids': []
        }
    return get_departments_map_by_username(username, org_id=org_id)


def get_ancestor_groups_by_department(department):
    dep_ids = DepartmentsV2.objects.get_ancestor_departments_ids(department)
    department_v2_groups = list(DepartmentV2Groups.objects.filter(department_id__in=dep_ids))
    return sorted(department_v2_groups, key=lambda x: x.id)

def is_user_open_department_feature(org_id):
    return DepartmentsV2.objects.filter(org_id=org_id).exists()
