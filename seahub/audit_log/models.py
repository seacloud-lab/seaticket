import json
import logging

from django.db import models
from django.dispatch import receiver
from django.utils import timezone

from seahub.settings import AUDIT_LOGS_RECORD_USER_OPERATIONS
from seahub.audit_log.signals import audit_operation, file_audit_operation
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.utils.timeutils import datetime_to_isoformat_timestr

logger = logging.getLogger(__name__)

## operation: detail

# 'group_transfer': {'id': group_id, 'name': group_name 'from': from, 'to': to}
GROUP_TRANSFER = 'group_transfer'
# 'group_rename': {'id': group_id, 'name': new_name, 'old_name': old_name}
GROUP_RENAME = 'group_rename'
# 'group_delete': {'id': group_id, 'name': group_name}
GROUP_DELETE = 'group_delete'

# 'group_base_delete': {'id': group_id, 'name': group_name, 'table_name': table_name}
GROUP_BASE_DELETE = 'group_base_delete'
# 'group_base_rename': {'id': group_id, 'name': group_name, 'old_table_name': old_table_name, 'new_table_name': old_table_name}
GROUP_BASE_RENAME = 'group_base_rename'
# 'group_table_create': {'id': group_id, 'name': group_name, 'table_name': table_name}
GROUP_BASE_CREATE = 'group_base_create'
# 'group_table_restore': {'id': group_id, 'name': group_name, 'table_name': table_name}
GROUP_BASE_RESTORE = 'group_base_restore'

# 'base_create': {'name': base_name}
BASE_CREATE = 'base_create'
# 'base_rename': {'old_name': old_base_name, 'new_name': new_base_name}
BASE_RENAME = 'base_rename'
# 'base_delete': {'name': base_name}
BASE_DELETE = 'base_delete'
# 'base_restore': {'name': base_name}
BASE_RESTORE = 'base_restore'

# 'account_delete': {'name': nickname, 'contact_email': contact_email}
ACCOUNT_DELETE = 'account_delete'

AUDIT_LOG_OPERATION_TYPES = [GROUP_TRANSFER, GROUP_RENAME, GROUP_DELETE, GROUP_BASE_DELETE, GROUP_BASE_RENAME, GROUP_BASE_CREATE, GROUP_BASE_RESTORE, BASE_CREATE, BASE_RENAME, BASE_DELETE, BASE_RESTORE, ACCOUNT_DELETE]

USER_COMMON_OPERATION_TYPES = [BASE_CREATE, BASE_RENAME, BASE_DELETE, BASE_RESTORE, ACCOUNT_DELETE]

class AuditLogManager(models.Manager):

    def add_audit_log(self, username, operation, detail, org_id):

        return super(AuditLogManager, self).create(
            username=username, operation=operation, detail=detail, org_id=org_id)

    def get_audit_logs(self, org_id=None):

        logs = super(AuditLogManager, self).all()

        kwargs = {}
        if org_id:
            kwargs['org_id'] = org_id

        logs = logs.filter(**kwargs)

        return logs

class AuditLog(models.Model):
    username = models.CharField(max_length=255, null=False)
    operation = models.CharField(max_length=255, null=False)
    detail = models.TextField()
    org_id = models.IntegerField(null=False)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    objects = AuditLogManager()

    class Meta:
        indexes = [
            models.Index(fields=['org_id', 'created_at'], name='audit_log_org_id_created_at')
        ]
        ordering = ['-created_at']

    def to_dict(self):
        try:
            detail = json.loads(self.detail)
        except Exception as e:
            logger.error('audit log: %s detail: %s', self.pk, self.detail)
            detail = {}

        operation = self.operation

        if operation == GROUP_TRANSFER:
            detail['from_nickname'] = email2nickname(detail.get('from'))
            detail['to_nickname'] = email2nickname(detail.get('to'))


        log_info = {
            'username': self.username,
            'name': email2nickname(self.username),
            'operation': self.operation,
            'org_id': self.org_id,
            'detail': detail,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
        }

        return log_info


class FileAccessLogManager(models.Manager):
    def add_file_access_log(self, etype, user, ip, device, org_id, dtable_uuid, file_path):

        return super(FileAccessLogManager, self).create(
            etype=etype, user=user, ip=ip, device=device, org_id=org_id,
            dtable_uuid=dtable_uuid, file_path=file_path)

    def get_file_access_logs(self, org_id=None):
        logs = super(FileAccessLogManager, self).all()
        kwargs = {}
        if org_id:
            kwargs['org_id'] = org_id

        logs = logs.filter(**kwargs)

        return logs


class FileAccessLog(models.Model):
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    etype = models.CharField(max_length=128, null=False)
    user = models.CharField(max_length=255, null=False)
    ip = models.CharField(max_length=255, null=False)
    device = models.TextField(null=False)
    org_id = models.IntegerField(null=False)
    dtable_uuid = models.CharField(max_length=36, null=False)
    file_path = models.TextField()

    objects = FileAccessLogManager()

    class Meta:
        db_table = 'file_access_log'
        ordering = ['-timestamp']

    def to_dict(self):

        return {
            'timestamp': datetime_to_isoformat_timestr(self.timestamp),
            'etype': self.etype,
            'device': self.device if self.device else '',
            'user': self.user,
            'name':  email2nickname(self.user),
            'contact_email':  email2contact_email(self.user),
            'ip': self.ip,
            'org_id': self.org_id,
            'dtable_uuid': str(self.dtable_uuid),
            'file_path': str(self.file_path)
        }


@receiver(audit_operation)
def audit_operation_cb(sender, **kwargs):
    operation = kwargs.get('operation')
    username = kwargs.get('username')
    org_id = kwargs.get('org_id', 0)
    detail = kwargs.get('detail')
    if operation not in AUDIT_LOG_OPERATION_TYPES:
        return
    elif operation in USER_COMMON_OPERATION_TYPES and not AUDIT_LOGS_RECORD_USER_OPERATIONS:
        return
    try:
        if isinstance(detail, dict):
            detail = json.dumps(detail)
        AuditLog.objects.add_audit_log(username, operation, detail, org_id)
    except Exception as e:
        logger.exception('add audit log user: %s operation: %s detail: %s org_id: %s error: %s', username, operation, detail, org_id, e)


@receiver(file_audit_operation)
def file_audit_operation_cb(sender, **kwargs):
    etype = kwargs.get('etype')
    username = kwargs.get('username')
    ip = kwargs.get('ip')
    user_agent = kwargs.get('user_agent')
    org_id = kwargs.get('org_id')
    dtable_uuid = kwargs.get('dtable_uuid')
    file_path = kwargs.get('path')

    try:
        FileAccessLog.objects.add_file_access_log(etype, username, ip, user_agent, org_id, dtable_uuid, file_path)
    except Exception as e:
        logger.exception('add file access log failed, etype: %s, user: %s,  ip: %s, user_agent: %s, '
                         'org_id: %s, dtable_uuid: %s, file_path: %s, error: %s', etype, username, ip,
                         user_agent, org_id, dtable_uuid, file_path, e)
