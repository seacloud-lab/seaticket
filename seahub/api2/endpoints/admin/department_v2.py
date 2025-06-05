import logging

from django.db import transaction, connection
from django.db.utils import IntegrityError
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from seaserv import ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean, get_user_common_info
from seahub.avatar.settings import AVATAR_DEFAULT_SIZE
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.ccnet_db.ccnet import db_name as ccnet_db_name
from seahub.ccnet_db.ccnet.groups import delete_GroupStructure, delete_GroupUser, update_group_info
from seahub.department_v2.models import DepartmentsV2, DepartmentMembersV2, DepartmentV2Groups
from seahub.dtable.models import Workspaces, DTables
from seahub.dtable.utils import create_repo_and_workspace, clean_related_users_cache_by_department, \
    clean_related_users_cache_by_group_ids
from seahub.group.utils import refresh_group_name_cache
from seahub.profile.models import Profile
from seahub.utils import get_no_duplicate_obj_name

logger = logging.getLogger(__name__)


class AdminAddressBookV2DepartmentsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        parent_id = request.GET.get('parent_id')
        try:
            org_id = int(request.GET.get('org_id', -1))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'org_id invalid')
        if not parent_id or parent_id == '-1':
            departments = DepartmentsV2.objects.get_org_top_departments(org_id)
        else:
            parent_department = DepartmentsV2.objects.get_department_by_id(parent_id)
            if not parent_department:
                return api_error(status.HTTP_404_NOT_FOUND, 'Department not found')
            departments = DepartmentsV2.objects.get_sub_departments(parent_id)
        return Response({
            'department_list': [d.to_dict() for d in departments]
        })

    def post(self, request):
        # arguments check
        try:
            parent_id = int(request.data.get('parent_id'))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'parent_id invalid')
        try:
            org_id = int(request.data.get('org_id', -1))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'org_id invalid')
        if parent_id < -1:
            return api_error(status.HTTP_400_BAD_REQUEST, 'parent_id invalid')
        name = request.data.get('name')
        if not name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'name invalid')

        # resource check
        if parent_id != -1:
            parent_department = DepartmentsV2.objects.get_department_by_id(parent_id)
            if not parent_department:
                return api_error(status.HTTP_404_NOT_FOUND, 'Department %s not found' % parent_id)
            if org_id != parent_department.org_id:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        else:
            top_department = DepartmentsV2.objects.get_org_top_departments(org_id)
            if top_department.exists():
                return api_error(status.HTTP_400_BAD_REQUEST, 'Top department exists')

        try:
            if DepartmentsV2.objects.filter(org_id=org_id, parent_id=parent_id, name=name).exists():
                return api_error(status.HTTP_400_BAD_REQUEST, 'Department %s exists' % name)
            department = DepartmentsV2.objects.create_department(name, parent_id, org_id)
        except IntegrityError:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Department %s exists' % name)
        except Exception as e:
            logger.error('create department error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'department': department.to_dict()})


class AdminAddressBookV2DepartmentView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, department_id):
        name = request.data.get('name')

        # resource check
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department %s not found' % department_id)

        if name:
            if DepartmentsV2.objects.filter(org_id=department.org_id, parent_id=department.parent_id, name=name).exists():
                return api_error(status.HTTP_400_BAD_REQUEST, 'Department %s exists' % name)
            department.name = str(name)

        group = DepartmentV2Groups.objects.filter(department=department).first()

        try:
            if group and name:
                ccnet_api.set_group_name(group.group_id, department.name)
                refresh_group_name_cache(group.group_id, department.name)
            department.save()
        except Exception as e:
            logger.error('update department error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'department': department.to_dict()})

    def delete(self, request, department_id):
        # resource check
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department %s not found' % department_id)

        if DepartmentsV2.objects.has_sub_departments(department.id):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Forbidden deleting departments with sub departments')

        group = DepartmentV2Groups.objects.filter(department=department).first()

        try:
            clean_related_users_cache_by_department(department)
            if group:
                ccnet_api.remove_group(group.group_id)
                group.delete()
            department.delete()
        except Exception as e:
            logger.error('delete department error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'success': True})


class AdminAddressBookV2DepartmentMembersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, department_id):
        # resource check
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department %s not found' % department_id)

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
        return Response({'member_list': user_list})

    def post(self, request, department_id):
        # arguments check
        emails = request.data.getlist('email')
        if not emails:
            return api_error(status.HTTP_400_BAD_REQUEST, 'username invalid')

        # resource check
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department %s not found' % department_id)

        result = {}
        result['failed'] = []
        result['success'] = []
        emails_need_add = []

        for email in emails:
            if not email:
                continue
            try:
                User.objects.get(email=email)
            except User.DoesNotExist:
                result['failed'].append({
                    'email': email,
                    'error_msg': 'User %s not found.' % email
                })
                continue
            email_name = email2nickname(email)
            if DepartmentMembersV2.objects.is_user_in_department_by_id(email, department.id):
                result['failed'].append({
                    'email': email,
                    'error_msg': 'User %s is already a department member.' % email_name
                })
                continue
            emails_need_add.append(email)

        # add users to department
        try:
            DepartmentMembersV2.objects.bulk_add_users(emails_need_add, department.id)
        except Exception as e:
            logger.error('bulk add users to department error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        for email in emails_need_add:
            result['success'].append(get_user_common_info(email))

        clean_related_users_cache_by_department(department)

        return Response(result)


class AdminAddressBookV2DepartmentMemberView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, department_id, email):
        # arguments check
        is_staff = request.data.get('is_staff')
        if is_staff is not None:
            try:
                is_staff = to_python_boolean(is_staff)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'is_staff invalid')

        # resource check
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department %s not found' % department_id)
        department_member = DepartmentMembersV2.objects.filter(username=email, department_id=department_id).first()
        if not department_member:
            return api_error(status.HTTP_404_NOT_FOUND, 'User %s not in the department' % email)

        try:
            if is_staff is not None:
                department_member.is_staff = is_staff
            department_member.save()
        except Exception as e:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        user_info = get_user_common_info(email)
        user_info['is_staff'] = department_member.is_staff

        return Response({'member': user_info})

    def delete(self, request, department_id, email):
        # resource check
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department %s not found' % department_id)
        department_member = DepartmentMembersV2.objects.filter(username=email, department_id=department_id).first()
        if not department_member:
            return Response({'success': True})
        try:
            department_member.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        clean_related_users_cache_by_department(department)

        return Response({'success': True})


class AdminAddUserToDepartmentsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return api_error(status.HTTP_400_BAD_REQUEST, 'email invalid')
        department_ids = request.data.get('department_ids')
        if not department_ids or not isinstance(department_ids, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'department_ids invalid')
        departments = list(DepartmentsV2.objects.filter(org_id=-1, id__in=department_ids))
        if not departments:
            return api_error(status.HTTP_400_BAD_REQUEST, 'department_ids invalid')
        has_been_members = DepartmentMembersV2.objects.filter(
            department_id__in=department_ids, username=email
        ).select_related('department')
        success, failed = [], []
        for member in has_been_members:
            failed.append({
                'department': member.department.to_dict(),
                'error_msg': 'User has been in %s' % member.department.name
            })
            departments = list(filter(lambda x: x.id != member.department.id, departments))
        created_at = timezone.now()
        try:
            department_members = [DepartmentMembersV2(
                department=department,
                username=email,
                is_staff=False,
                created_at=created_at
            ) for department in departments]
            DepartmentMembersV2.objects.bulk_create(department_members)
        except Exception as e:
            logger.error('add user: %s to departments: %s error: %s', email, department_ids, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        else:
            for member in department_members:
                success.append(member.department.to_dict())
        return Response({'success': success, 'failed': failed})


class AdminDepartmentsMigrateView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def migrate_department_v1(self, department_v1, parent_id, group_ids):
        # create department-v2
        ## generate non-duplicated name
        name_v1 = department_v1.group_name
        exists_names = list(DepartmentsV2.objects.get_sub_departments(parent_id).values_list('name', flat=True))
        name_v2 = get_no_duplicate_obj_name(name_v1, exists_names)
        department_v2 = DepartmentsV2.objects.create_department(name_v2, parent_id, -1)
        # create department-v2 members with is_staff
        members_v2 = []
        members_v1 = ccnet_api.get_group_members(department_v1.id)
        for member_v1 in members_v1:
            members_v2.append(DepartmentMembersV2(
                department_id=department_v2.id,
                username=member_v1.user_name,
                is_staff=member_v1.is_staff or False,
                created_at=timezone.now()
            ))
        DepartmentMembersV2.objects.bulk_create(members_v2)
        # create sub-departments
        sub_deparmtents_v1 = ccnet_api.get_child_groups(department_v1.id)
        for sub_department_v1 in sub_deparmtents_v1:
            self.migrate_department_v1(sub_department_v1, department_v2.id, group_ids)
        # set department_v1 to common group
        ## update parent_group_id to 0 on ccnet db
        update_group_info(department_v1.id, {'parent_group_id': 0, 'group_name': name_v2})
        ## delete department_v1 members on ccnet db
        delete_GroupUser(department_v1.id)
        ## delete group-structure on ccnet db
        delete_GroupStructure(department_v1.id)
        # bind department_v2 and group
        DepartmentV2Groups.objects.create(department=department_v2, group_id=department_v1.id)
        # record group id
        group_ids.append(department_v1.id)
        return department_v2

    def post(self, request):
        top_department_v2 = DepartmentsV2.objects.get_top_departments().first()
        if not top_department_v2:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Please create a top-level department in the new version departments feature first')
        departments_v1 = ccnet_api.get_top_groups()
        departments_v2 = []
        group_ids = []
        try:
            with transaction.atomic():
                for department_v1 in departments_v1:
                    department_v2 = self.migrate_department_v1(department_v1, top_department_v2.id, group_ids)
                    departments_v2.append(department_v2)
            clean_related_users_cache_by_department(top_department_v2)
            clean_related_users_cache_by_group_ids(group_ids)
        except Exception as e:
            logger.exception('migarate departments v1 to v2 error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'department_list': [dep.to_dict() for dep in departments_v2]})


class AdminAddressBookV2DepartmentGroupView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, department_id):
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department not found')
        group = DepartmentV2Groups.objects.filter(department=department).first()
        if group:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Group of department exists')
        try:
            if department.org_id == -1:
                group_id = ccnet_api.create_group(department.name, 'system admin')
            else:
                group_id = ccnet_api.create_org_group(department.org_id, department.name, 'system admin')
            DepartmentV2Groups.objects.create(department=department, group_id=group_id)
            owner = '%s@seafile_group' % group_id
            create_repo_and_workspace(owner, department.org_id)
        except Exception as e:
            logger.exception('create department %s group error: %s', department_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({
            'group_id': group_id,
            'group_name': department.name
        })

    def get(self, request, department_id):
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department not found')
        department_group = DepartmentV2Groups.objects.filter(department=department).first()
        if not department_group:
            return api_error(status.HTTP_404_NOT_FOUND, 'Group of department not created')
        ccnet_group = ccnet_api.get_group(department_group.group_id)
        if not ccnet_group:
            return api_error(status.HTTP_404_NOT_FOUND, 'Group of department not found')
        return Response({
            'group_id': department_group.group_id,
            'group_name': ccnet_group.group_name
        })

    def delete(self, request, department_id):
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department not found')
        department_group = DepartmentV2Groups.objects.filter(department=department).first()
        if not department_group:
            return Response({'success': True})
        ccnet_group = ccnet_api.get_group(department_group.group_id)
        if not ccnet_group:
            return Response({'success': True})

        # dtables check
        owner = '%s@seafile_group' % (department_group.group_id)
        workspace = Workspaces.objects.filter(owner=owner).first()
        if workspace and DTables.objects.filter(workspace=workspace, deleted=False).exists():
            return api_error(status.HTTP_400_BAD_REQUEST, _('Cannot delete group with bases'))

        # mark group's workspace as deleted
        try:
            Workspaces.objects.delete_workspace(workspace.id)
        except Exception as e:
            logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        ccnet_api.remove_group(ccnet_group.id)
        department_group.delete()
        return Response({'success': True})


class AdminNonAddressBookV2UsersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        # for pagination need a sql query, join ccnet.<table-name> left join dtable.department_members_v2
        sql = '''
            SELECT eu.email FROM %(ccnet_db)s.EmailUser eu
            LEFT JOIN %(ccnet_db)s.OrgUser ou ON eu.email=ou.email
            LEFT JOIN department_members_v2 dm ON eu.email=dm.username
            WHERE eu.is_active=1 AND ou.email IS NULL AND dm.id IS NULL
        '''
        emails = []
        try:
            with connection.cursor() as cursor:
                cursor.execute(sql % {
                    'ccnet_db': ccnet_db_name
                })
                for row in cursor.fetchall():
                    if '@seafile_group' in row[0]:
                        continue
                    emails.append(row[0])
        except Exception as e:
            logger.exception('query non-dep usernames error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        user_infos = list(Profile.objects.filter(user__in=emails).values('user', 'nickname', 'contact_email'))
        user_list = []
        for user_info in user_infos:
            avatar_url = api_avatar_url(user_info['user'])[0]
            user_list.append({
                'email': user_info['user'],
                'name': user_info['nickname'],
                'contact_email': user_info['contact_email'],
                'avatar_url': avatar_url,
            })
        return Response({'user_list': user_list})
