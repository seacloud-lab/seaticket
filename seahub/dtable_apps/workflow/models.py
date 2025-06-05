import json
import uuid

from django.db import models
from django.dispatch import receiver
from django.urls.base import reverse
from django.utils import timezone

from seahub.dtable_apps.workflow.utils import LOG_TYPE_COUNTER, LOG_TYPE_INIT, LOG_TYPE_TRANSFER, get_specific_node_from_config
from seahub.dtable_apps.workflow.signals import invalidate_workflow_task
from seahub.profile.models import Profile
from seahub.settings import DTABLE_WEB_SERVICE_URL
from seahub.utils import get_no_duplicate_obj_name
from seahub.utils.timeutils import datetime_to_isoformat_timestr


class DTableWorkflowsManager(models.Manager):

    def get_workflow_by_token(self, token):
        return self.filter(token=token).first()

    def get_workflows_by_dtable_uuid(self, dtable_uuid):
        return self.filter(dtable_uuid=str(dtable_uuid).replace('-', ''))

    def add_workflow(self, dtable_uuid, workflow_config, creator, owner):
        token = uuid.uuid4()
        workflow = self.create(
            token=str(token),
            dtable_uuid=str(dtable_uuid).replace('-', ''),
            workflow_config=workflow_config,
            creator=creator,
            owner=owner
        )
        return workflow

    def get_workflows_by_group_ids(self, group_ids):
        owners = ['%s@seafile_group' % group_id for group_id in group_ids]
        return self.filter(owner__in=owners).order_by('owner')


class DTableWorkflows(models.Model):
    token = models.CharField(max_length=36, unique=True)
    dtable_uuid = models.CharField(max_length=36, db_index=True)
    workflow_config = models.TextField()
    creator = models.CharField(max_length=255)
    owner = models.CharField(max_length=255, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    visit_times = models.IntegerField(default=0)

    objects = DTableWorkflowsManager()

    class Meta:
        db_table = 'dtable_workflows'

    def to_dict(self):
        workflow_edit_link = DTABLE_WEB_SERVICE_URL.strip('/') + reverse('dtable_workflow_edit', args=(self.token,))
        return {
            'id': self.pk,
            'token': self.token,
            'dtable_uuid': self.dtable_uuid,
            'workflow_config': self.workflow_config,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'visit_times': self.visit_times,
            'creator': self.creator,
            'owner': self.owner,
            'workflow_edit_link': workflow_edit_link,
        }

    @property
    def group_id(self):
        try:
            group_id = int(self.owner.split('@')[0])
        except:
            return None
        return group_id


class DTableWorkflowShareManager(models.Manager):

    def has_shared_to_group(self, dtable_workflow, group_id):
        return self.filter(dtable_workflow=dtable_workflow, group_id=group_id).exists()

    def get_shares_by_workflow(self, dtable_workflow):
        return self.filter(dtable_workflow=dtable_workflow).order_by('id')

    def list_by_group_ids(self, group_ids):
        return self.filter(group_id__in=group_ids).order_by('group_id').select_related('dtable_workflow')


class DTableWorkflowShare(models.Model):
    dtable_workflow = models.ForeignKey(DTableWorkflows, on_delete=models.CASCADE)
    group_id = models.IntegerField(db_index=True)
    created_by = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = DTableWorkflowShareManager()

    class Meta:
        db_table = 'dtable_workflow_share'
        unique_together = [('dtable_workflow', 'group_id')]


class DTableWorkflowTasksManager(models.Manager):

    def get_task_by_token_id(self, token, task_id):
        return self.filter(dtable_workflow__token=token, pk=task_id).select_related('dtable_workflow').first()

    def get_tasks_by_token(self, token):
        return self.filter(dtable_workflow__token=token).select_related('dtable_workflow').order_by('-created_at')

    def get_tasks_by_token_initiator(self, token, initiator):
        return self.filter(dtable_workflow__token=token, initiator=initiator).select_related('dtable_workflow').order_by('-created_at')

    def get_tasks_by_token_state(self, token, task_state):
        return self.filter(dtable_workflow__token=token, task_state=task_state).select_related('dtable_workflow').order_by('-created_at')

    def get_task_by_token_row_id(self, token, row_id):
        return self.filter(dtable_workflow__token=token, row_id=row_id).select_related('dtable_workflow').first()

    def get_tasks_by_token_row_ids(self, token, row_ids):
        return self.filter(dtable_workflow__token=token, row_id__in=row_ids).select_related('dtable_workflow')
        


class DTableWorkflowTasks(models.Model):
    dtable_workflow = models.ForeignKey(DTableWorkflows, on_delete=models.CASCADE)
    row_id = models.CharField(max_length=36, null=False, db_index=True)
    initiator = models.CharField(max_length=255, db_index=True)
    node_id = models.CharField(max_length=50, null=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    task_state = models.CharField(max_length=40)
    finished_at = models.DateTimeField(default=None)
    is_valid = models.BooleanField(default=True)

    objects = DTableWorkflowTasksManager()

    class Meta:
        db_table = 'dtable_workflow_tasks'

    def to_dict(self):
        transfer_url = DTABLE_WEB_SERVICE_URL.strip('/') + reverse('dtable_workflow_task_transfer', args=(self.dtable_workflow.token, self.pk))
        submitted_url = DTABLE_WEB_SERVICE_URL.strip('/') + reverse('dtable_workflow_task_submitted', args=(self.dtable_workflow.token, self.pk))
        node = get_specific_node_from_config(self.dtable_workflow.workflow_config, self.node_id)
        state = node.get('name') if node else None
        return {
            'id': self.pk,
            'row_id': self.row_id,
            'initiator': self.initiator,
            'node_id': self.node_id,
            'dtable_workflow': self.dtable_workflow.to_dict(),
            'transfer_url': transfer_url,
            'submitted_url': submitted_url,
            'state': state,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'task_state': self.task_state,
            'finished_at': datetime_to_isoformat_timestr(self.finished_at),
            'is_valid': self.is_valid
        }


class DTableWorkflowTaskParticipantsManager(models.Manager):

    def can_transfer(self, task, username):
        return self.filter(dtable_workflow_task=task, participant=username).exists()

    def gen_db_participants(self, task_id, node_id, participants, filter_valid=True):
        if filter_valid:
            valid_participants = set(Profile.objects.filter(user__in=participants).values_list('user', flat=True))
        else:
            valid_participants = set(participants)
        db_participants = [DTableWorkflowTaskParticipants(
            dtable_workflow_task_id=task_id,
            node_id=node_id,
            participant=participant
        ) for participant in valid_participants]
        return db_participants

    def bulk_add_participants(self, task_id, node_id, participants, filter_valid=True):
        db_participants = self.gen_db_participants(task_id, node_id, participants, filter_valid=filter_valid)
        self.bulk_create(db_participants)
        return db_participants

class DTableWorkflowTaskParticipants(models.Model):
    dtable_workflow_task = models.ForeignKey(DTableWorkflowTasks, on_delete=models.CASCADE)
    node_id = models.CharField(max_length=50, null=False, db_index=True)
    participant = models.CharField(max_length=255, null=False, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = DTableWorkflowTaskParticipantsManager()

    class Meta:
        db_table = 'dtable_workflow_task_participants'


class DTableWorkflowTaskLogsManager(models.Manager):

    def add_init_log(self, task, initiator, node_id, next_node_id=None):
        return self.create(
            task=task,
            operator=initiator,
            log_type=LOG_TYPE_INIT,
            node_id=node_id,
            next_node_id=next_node_id,
            start_at=timezone.now()
        )

    def add_transfer_log(self, task, participant, node_id, next_node_id=None):
        last_node_log = self.get_task_last_node_log(task, node_id)
        if last_node_log:
            start_at = last_node_log.created_at
        else:
            start_at = None
        return self.create(
            task=task,
            operator=participant,
            log_type=LOG_TYPE_TRANSFER,
            node_id=node_id,
            next_node_id=next_node_id,
            start_at=start_at
        )

    def add_counter_log(self, task, participant, node_id):
        last_node_log = self.get_task_last_node_log(task, node_id)
        if last_node_log:
            start_at = last_node_log.created_at
        else:
            start_at = None
        return self.create(
            task=task,
            operator=participant,
            log_type=LOG_TYPE_COUNTER,
            node_id=node_id,
            next_node_id=None,
            start_at=start_at
        )

    def has_participated(self, task, username):
        return self.filter(task=task, operator=username).exclude(log_type=LOG_TYPE_INIT).exists()

    def get_task_last_node_log(self, task, current_node_id):
        return self.filter(task=task).filter(next_node_id=current_node_id).order_by('-created_at').first()

    def get_handled_logs(self, username):
        queryset = self.filter(
            operator=username
        ).exclude(
            log_type=LOG_TYPE_INIT
        ).select_related(
            'task',
            'task__dtable_workflow'
        ).order_by('created_at')

        return queryset


class DTableWorkflowTaskLogs(models.Model):
    task = models.ForeignKey(DTableWorkflowTasks, on_delete=models.CASCADE, db_column='task_id')
    operator = models.CharField(max_length=255, null=False, db_index=True)
    log_type = models.CharField(max_length=20, null=False, db_index=True)
    node_id = models.CharField(max_length=50, default=None)
    next_node_id = models.CharField(max_length=50, default=None)
    row_data = models.TextField()
    start_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    objects = DTableWorkflowTaskLogsManager()

    class Meta:
        db_table = 'dtable_workflow_task_logs'

    def to_dict(self, with_row_data=True):
        if self.start_at and self.created_at:
            duration_timedelta = self.created_at - self.start_at
            days = duration_timedelta.days
            seconds = duration_timedelta.seconds
            duration = days * 24 * 3600 + seconds
        else:
            duration = None
        info = {
            'id': self.id,
            'task_id': self.task_id,
            'operator': self.operator,
            'log_type': self.log_type,
            'node_id': self.node_id,
            'next_node_id': self.next_node_id,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'start_at': self.start_at,
            'duration': duration
        }

        if with_row_data:
            info['row_data'] = self.row_data

        return info


class DTableWorkflowTaskSchedules(models.Model):
    task = models.ForeignKey(DTableWorkflowTasks, on_delete=models.CASCADE, db_column='task_id')
    schedule_time = models.DateTimeField(db_index=True)
    action = models.TextField()
    is_executed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dtable_workflow_task_schedules'


class WorkflowFoldersManager(models.Manager):
    def get_non_duplicated_name(self, name, username, folder_type):
        folders = super(WorkflowFoldersManager, self).filter(username=username, name__startswith=name, folder_type=folder_type)
        existed_names = [f.name for f in folders]
        if not existed_names or name not in existed_names:
            return name
        return get_no_duplicate_obj_name(name, existed_names)


class WorkflowFolders(models.Model):
    name = models.CharField(max_length=255, null=False)
    username = models.CharField(max_length=255, null=False)
    folder_type = models.CharField(max_length=255, null=False)

    objects = WorkflowFoldersManager()

    class Meta:
        db_table = 'workflow_folders'
        unique_together = [('username', 'name', 'folder_type')]

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'username': self.username,
            'folder_type': self.folder_type
        }


class WorkflowFolderItems(models.Model):
    folder_id = models.IntegerField(null=False)
    workflow_id = models.IntegerField(null=False, db_index=True)

    class Meta:
        db_table = 'workflow_folder_items'
        unique_together = [('folder_id', 'workflow_id')]

    def to_dict(self):
        return {
            'folder_id': self.folder_id,
            'workflow_id': self.workflow_id,
        }


@receiver(invalidate_workflow_task)
def invalidate_workflow_task_cb(sender, **kwargs):
    task_ids = kwargs.get('task_ids')
    if not task_ids:
        return
    if not isinstance(task_ids, list):
        task_ids = [task_ids]
    DTableWorkflowTasks.objects.filter(id__in=task_ids).update(is_valid=False)
