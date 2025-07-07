# Copyright (c) 2012-2017 Seafile Ltd.
import json
import datetime

from django.db import models
from django.dispatch import receiver

from seahub.admin_log.signals import admin_operation, org_admin_operation

## operation: detail

# 'group_create': {'id': group_id, 'name': group_name, 'owner': group_owner}
GROUP_CREATE = 'group_create'
# 'group_transfer': {'id': group_id, 'name': group_name, 'from': from_user, 'to': to_user}
GROUP_TRANSFER = 'group_transfer'
# 'group_delete': {'id': group_id, 'name': group_name, 'owner': group_owner}
GROUP_DELETE = 'group_delete'
# 'department_create': {'id': department_id, 'name': department_name}
DEPARTMENT_CREATE = 'department_create'
# 'department_rename': {'id': department_id, 'old_name': old_department_name, 'new_name': new_department_name}
DEPARTMENT_RENAME = 'department_rename'
# 'department_delete': {'name': department_name}
DEPARTMENT_DELETE = 'department_delete'


# 'base_delete': {'name': base_name, 'dtable_uuid': dtable_uuid, [, 'group_id': group_id, 'group_name': group_name] [, 'org_id': org_id, 'org_name': org_name]}
BASE_DELETE = 'base_delete'
# 'base_restore': {'name': base_name [, 'group_id': group_id, 'group_name': group_name] [, 'org_id': org_id, 'org_name': org_name]}
BASE_RESTORE = 'base_restore'
# 'base_repair': {'name': base_name [, 'group_id': group_id, 'group_name': group_name] [, 'org_id': org_id, 'org_name': org_name]}
BASE_REPAIR = 'base_repair'

# 'user_add': {'email': new_user, 'username': username}
USER_ADD = 'user_add'
# 'user_delete': {'email': deleted_user}  sys admin
# 'user_delete': {'username': deleted_user, 'nickname': nickname}  org admin
USER_DELETE = 'user_delete'
USER_ACTIVATE = "user_activate"
USER_DEACTIVATE = "user_deactivate"
USER_SET_ORG_ADMIN = 'user_set_org_admin'
USER_UNSET_ORG_ADMIN = 'user_unset_org_admin'

ADMIN_LOG_OPERATION_TYPE = (
        GROUP_CREATE, GROUP_TRANSFER, GROUP_DELETE,
        BASE_DELETE, BASE_RESTORE, BASE_REPAIR,
        USER_ADD, USER_DELETE, USER_ACTIVATE, USER_DEACTIVATE, USER_SET_ORG_ADMIN, USER_UNSET_ORG_ADMIN
        )

ORGADMIN_LOG_OPERATION_TYPE = (
    GROUP_CREATE, GROUP_TRANSFER, GROUP_DELETE,
    BASE_DELETE, BASE_RESTORE,
    DEPARTMENT_CREATE, DEPARTMENT_RENAME, DEPARTMENT_DELETE,
    USER_ADD, USER_DELETE, USER_ACTIVATE, USER_DEACTIVATE
)


class AdminLogManager(models.Manager):

    def add_admin_log(self, email, operation, detail):

        model= super(AdminLogManager, self).create(
            email=email, operation=operation, detail=detail)

        model.save()

        return model

    def get_admin_logs(self, email=None, operation=None):

        logs = super(AdminLogManager, self).all()

        if email:
            logs = logs.filter(email=email)

        if operation:
            logs = logs.filter(operation=operation)

        return logs

class AdminLog(models.Model):
    email = models.EmailField(db_index=True)
    operation = models.CharField(max_length=255, db_index=True)
    detail = models.TextField()
    datetime = models.DateTimeField(default=datetime.datetime.now)
    objects = AdminLogManager()

    class Meta:
        ordering = ["-datetime"]


class OrgAdminLogManager(models.Manager):

    def add_admin_log(self, email, operation, detail, org_id):

        model = super(OrgAdminLogManager, self).create(
            email=email, operation=operation, detail=detail, org_id=org_id)

        model.save()

        return model

    def get_admin_logs(self, org_id, email=None, operation=None):

        logs = super(OrgAdminLogManager, self).all()

        if email:
            logs = logs.filter(email=email)

        if operation:
            logs = logs.filter(operation=operation)
        logs = logs.filter(org_id=org_id)

        return logs


class OrgAdminLog(models.Model):
    email = models.EmailField(db_index=True)
    operation = models.CharField(max_length=255, db_index=True)
    detail = models.TextField()
    datetime = models.DateTimeField(default=datetime.datetime.now)
    org_id = models.IntegerField(default=-1, db_index=True)
    objects = OrgAdminLogManager()

    class Meta:
        ordering = ["-datetime"]


###### signal handlers
@receiver(admin_operation)
def admin_operation_cb(sender, **kwargs):
    admin_name = kwargs['admin_name']
    operation = kwargs['operation']
    detail = kwargs['detail']

    detail_json = json.dumps(detail)
    AdminLog.objects.add_admin_log(admin_name, operation, detail_json)


@receiver(org_admin_operation)
def org_admin_operation_cb(sender, **kwargs):
    admin_name = kwargs['admin_name']
    operation = kwargs['operation']
    detail = kwargs['detail']
    org_id = kwargs['org_id']

    detail_json = json.dumps(detail)
    OrgAdminLog.objects.add_admin_log(admin_name, operation, detail_json, org_id)
