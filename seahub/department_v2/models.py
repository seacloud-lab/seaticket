from django.db import models
from django.db.models import Max
from django.dispatch import receiver
from django.utils import timezone

from seahub.registration.signals import user_deleted


class DepartmentsV2Manager(models.Manager):

    def get_department_by_id(self, department_id):
        return self.filter(id=department_id).first()

    def get_org_department_by_id(self, org_id, department_id):
        return self.filter(id=department_id, org_id=org_id).first()

    def get_ancestor_departments_ids(self, department, include_self=True):
        dep_ids = []
        for dep_id in department.path.strip('/').split('/'):
            if not include_self and dep_id == department.id:
                continue
            try:
                dep_ids.append(int(dep_id))
            except:
                pass
        return dep_ids

    def get_ancestor_departments(self, department, include_self=True):
        """ancestor departments from high to low levels, including department-self
        """
        dep_ids = self.get_ancestor_departments_ids(department, include_self=include_self)
        results = self.filter(id__in=dep_ids).order_by('id')
        return results

    def get_ancestor_departments_by_id(self, department_id, include_self=True):
        department = self.get_department_by_id(department_id)
        return self.get_ancestor_departments(department, include_self=include_self)

    def get_sub_departments(self, department_id):
        return self.filter(parent_id=department_id).order_by('id')

    def has_sub_departments(self, department_id):
        return self.filter(parent_id=department_id).exists()

    def get_all_sub_departments(self, department):
        return self.filter(org_id=department.org_id, path__startswith=department.path+'/')

    def get_deparment_tree(self, department):
        """add sub-deparments to department as a property naming `sub_departments` recursively

        :return: department with sub-departments
        """
        all_sub_departments = list(self.get_all_sub_departments(department))
        stack = [department]
        while stack:
            top_department = stack.pop()
            sub_departments = [dep for dep in all_sub_departments if dep.parent_id == top_department.id]
            stack.extend(sub_departments)
            top_department.sub_departments = sub_departments
        return department

    def get_top_departments(self):
        return self.filter(parent_id=-1, org_id=-1).order_by('id')

    def get_org_top_departments(self, org_id):
        return self.filter(parent_id=-1, org_id=org_id).order_by('id')

    def get_max_id_in_org(self, org_id):
        max_info = self.filter(org_id=org_id).aggregate(Max('id_in_org'))
        return max_info.get('id_in_org__max') or 0

    def create_department(self, name, parent_id, org_id):
        next_id_in_org = self.get_max_id_in_org(org_id) + 1
        department = self.create(name=name, parent_id=parent_id, created_at=timezone.now(), org_id=org_id, id_in_org=next_id_in_org)
        if parent_id == -1:
            department.path = f'/{department.id}'
        else:
            parent_department = DepartmentsV2.objects.get_department_by_id(parent_id)
            department.path = f'{parent_department.path}/{department.id}'
        department.save()
        return department


class DepartmentsV2(models.Model):
    name = models.CharField(max_length=255, null=False, blank=False)
    created_at = models.DateTimeField()
    parent_id = models.IntegerField(null=False, db_index=True)
    org_id = models.IntegerField()
    id_in_org = models.IntegerField(null=False)
    path = models.CharField(max_length=1024, db_index=True, default='')

    objects = DepartmentsV2Manager()

    class Meta:
        db_table = 'departments_v2'
        unique_together = (('org_id', 'id_in_org'),)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'parent_id': self.parent_id,
            'org_id': self.org_id,
            'id_in_org': self.id_in_org
        }


class DepartmentMembersV2Manager(models.Manager):

    def get_user_departments(self, username, is_staff=None, org_id=None):
        kwargs = {'username': username}
        if is_staff is not None:
            kwargs['is_staff'] = is_staff
        if org_id:
            kwargs['department__org_id'] = org_id
        return [dm.department for dm in self.filter(**kwargs).select_related('department').order_by('department__pk')]

    def get_department_members_by_id(self, department_id):
        return self.filter(department_id=department_id)

    def is_user_in_department_by_id(self, username, department_id):
        return self.filter(username=username, department_id=department_id).exists()

    def is_user_in_departments_by_ids(self, username, department_ids):
        return self.filter(username=username, department_id__in=department_ids).exists()

    def is_user_departments_staff_by_ids(self, username, department_ids):
        return self.filter(username=username, department_id__in=department_ids, is_staff=True).exists()

    def can_user_access_department(self, username, department):
        """in department or in ancestors department
        """
        ancestor_departments = DepartmentsV2.objects.get_ancestor_departments(department)
        return self.is_user_in_departments_by_ids(username, [d.id for d in list(ancestor_departments) + [department]])

    def can_user_access_department_by_id(self, username, department_id):
        department = DepartmentsV2.objects.get_department_by_id(department_id)
        return self.can_user_access_department(username, department)

    def can_user_access_department_member_dtables(self, username, department):
        """user in one of ancestor departments
        """
        ancestor_departments = DepartmentsV2.objects.get_ancestor_departments(department)
        return self.is_user_in_departments_by_ids(username, [d.id for d in ancestor_departments])

    def can_user_manage_department(self, username, department):
        """need user is a staff of department or one of ancestor departments
        """
        ancestor_departments = DepartmentsV2.objects.get_ancestor_departments(department)
        return self.is_user_departments_staff_by_ids(username, [d.id for d in ancestor_departments + [department]])

    def bulk_add_users(self, usernames, department_id):
        return self.bulk_create([DepartmentMembersV2(
            department_id=department_id,
            username=username,
            created_at=timezone.now()
        ) for username in usernames])

    def get_department_members(self, department_id):
        return self.filter(department_id=department_id)

    def get_department_admins_by_id(self, department_id):
        return self.filter(department_id=department_id, is_staff=True)

    def get_all_sub_departments_members(self, department):
        return self.filter(department__org_id=department.org_id, department__path__startswith=department.path+'/')


class DepartmentMembersV2(models.Model):
    department = models.ForeignKey(DepartmentsV2, on_delete=models.CASCADE)
    username = models.CharField(max_length=255, null=False, blank=False, db_index=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateField()

    objects = DepartmentMembersV2Manager()

    class Meta:
        db_table = 'department_members_v2'
        unique_together = (('department_id', 'username'),)


class DepartmentV2Groups(models.Model):
    department = models.ForeignKey(DepartmentsV2, on_delete=models.CASCADE)
    group_id = models.BigIntegerField(unique=True)

    class Meta:
        db_table = 'department_v2_groups'
        unique_together = (('department_id', 'group_id'),)

    def delete(self):
        from seahub.dtable.models import Workspaces

        owner = '%s@seafile_group' % self.group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if workspace:
            Workspaces.objects.delete_workspace(workspace.id)
        super(DepartmentV2Groups, self).delete()


@receiver(user_deleted)
def user_deleted_cb(sender, **kwargs):
    username = kwargs.get('username')
    DepartmentMembersV2.objects.filter(username=username).delete()
