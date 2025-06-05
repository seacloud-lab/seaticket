from django.db import models
import json
import time

from django.dispatch import receiver
from django.utils import timezone
from django.contrib.auth.hashers import make_password


from seahub.dtable.models import DTableExternalApps
from seahub.dtable.utils import gen_share_unversal_app_link
from seahub.dtable_apps.universal_app.signals import external_app_deleted, new_app_row_comment
from seahub.dtable_apps.universal_app.utils import get_common_user_info, get_app_user
from seahub.utils import gen_token, get_no_duplicate_obj_name
from seahub.utils.timeutils import datetime_to_isoformat_timestr, utc_datetime_to_isoformat_timestr, \
    timestamp_to_isoformat_timestr
from constance import config


# define a serise models for anonymous app users

class AppInvalidRole(object):
    id = None
    app = None
    role_name = ''
    role_permission = ''
    role_permission_detail = None
    created_at = None
    pk = None

class AppAnonymousUser(object):
    id = None
    app = None
    username = 'anonymous'
    role = AppInvalidRole()
    created_at = None
    is_active = True
    pk = None

class DTableAppRolesManager(models.Manager):

    def get_app_role_by_name(self, app, role_name):
        try:
            return self.get(
                app=app,
                role_name=role_name
            )
        except self.model.DoesNotExist:
            return None


    def generate_app_default_role(self, app):
        app_role, _ = self.get_or_create(
            app=app,
            role_name='default',
            role_permission='rw',
        )
        return app_role

    def generate_app_admin_role(self, app):
        app_role, _ = self.get_or_create(
            app=app,
            role_name='admin',
            role_permission='rw',
        )
        return app_role

class DTableAppRoles(models.Model):
    app = models.ForeignKey(DTableExternalApps, db_index=True, null=False, related_name='app_roles', on_delete=models.CASCADE)
    role_name = models.CharField(max_length=255, null=False)
    role_permission = models.CharField(max_length=255, null=False)
    role_permission_detail = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = DTableAppRolesManager()


    class Meta:
        db_table = 'dtable_app_roles'
        unique_together = (('app', 'role_name'),)


    def to_dict(self):
        return {
            'id': self.pk,
            'app_name': self.app.app_name,
            'role_name': self.role_name,
            'role_permission': self.role_permission,
            'role_permission_detail': self.role_permission_detail and json.loads(self.role_permission_detail) or None,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
        }


class DTableAppUsersManager(models.Manager):

    def create_app_user_by_role(self, username, app, role_name='default'):
        app_user = self.filter(username=username, app=app).first()
        if app_user:
            return app_user

        app_role, _ = DTableAppRoles.objects.get_or_create(
            app=app,
            role_name=role_name,
            role_permission='rw',
        )

        app_user = self.create(
            username = username,
            role_id = app_role.pk,
            app = app
        )
        return app_user


class DTableAppUsers(models.Model):
    app = models.ForeignKey(DTableExternalApps, db_index=True, null=False, related_name='app_users', on_delete=models.CASCADE)
    username = models.CharField(max_length=255, null=False)
    role = models.ForeignKey(DTableAppRoles, null=False, related_name='role_users', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    objects = DTableAppUsersManager()

    class Meta:
        db_table = 'dtable_app_users'
        unique_together = (('app', 'username'),)

    def set_inactive(self):
        self.is_active = False
        self.save()

    def set_active(self):
        self.is_active = True
        self.save()

    def set_default_role(self):
        default_role = DTableAppRoles.objects.generate_app_default_role(self.app)
        self.role = default_role
        self.save()

    def set_admin_role(self):
        admin_role = DTableAppRoles.objects.generate_app_admin_role(self.app)
        self.role = admin_role
        self.save()

    def to_dict(self):
        return {
            'id': self.pk,
            'email': self.username,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'is_active': self.is_active,
        }


class DTableAppUserSyncManager(models.Manager):

    def get_table_ids_by_uuid(self, dtable_uuid):
        app_user_syncs = self.filter(app__dtable_uuid=dtable_uuid)
        table_ids = [aus.dst_table_id for aus in app_user_syncs]
        return table_ids


class DTableAppUserSync(models.Model):
    app = models.OneToOneField(DTableExternalApps, on_delete=models.CASCADE, db_index=True, db_column='app_id', related_name='sync_info')
    dst_table_id = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField()

    objects = DTableAppUserSyncManager()

    class Meta:
        db_table = 'dtable_app_user_sync'

    def to_dict(self):
        return {
            'id': self.pk,
            'app_id': self.app.pk,
            'table_id': self.dst_table_id,
            'created_at': utc_datetime_to_isoformat_timestr(self.created_at),
            'updated_at': utc_datetime_to_isoformat_timestr(self.updated_at)
        }

class DTableAppInviteLinksManager(models.Manager):
    def create_link(self, app, role, username, password=None, expire_date=None):
        if password:
            password = make_password(password)
        token = gen_token(max_length=config.SHARE_LINK_TOKEN_LENGTH)
        sdl = self.create(
            app=app,
            username=username,
            token=token,
            expire_date=expire_date,
            password=password,
            role=role
        )
        return sdl


class DTableAppInviteLinks(models.Model):
    app = models.ForeignKey(DTableExternalApps, on_delete=models.CASCADE, db_index=True, db_column='app_id')
    username = models.CharField(max_length=255, db_index=True)
    token = models.CharField(max_length=100, unique=True)
    ctime = models.DateTimeField(auto_now_add=True)
    password = models.CharField(max_length=128, null=True)
    role = models.ForeignKey(DTableAppRoles, null=False, related_name='role_links', on_delete=models.CASCADE)
    expire_date = models.DateTimeField(null=True)


    objects = DTableAppInviteLinksManager()
    class Meta:
        db_table = 'dtable_app_invite_links'

    def is_owner(self, username):
        return self.username == username

    def is_expired(self):
        if not self.expire_date:
            return False
        else:
            return self.expire_date < timezone.now()

    def is_encrypted(self):
        return False if not self.password else True

    def to_dict(self):
        return {
            'username': self.username,
            'token': self.token,
            'link': gen_share_unversal_app_link(self.token),
            'app_name': self.app.app_name,
            'app_id': self.app.pk,
            'expire_date': datetime_to_isoformat_timestr(self.expire_date),
            'ctime': datetime_to_isoformat_timestr(self.ctime),
            'is_protected': self.is_encrypted(),
            'role_name': self.role.role_name,
            'role_permission': self.role.role_permission,
            'role_id': self.role.pk
        }

class DTableAppNotificationManager(models.Manager):

    
    def add_notification(self, app, username, msg_type='notification_rules', detail=None):
        return self.create(
            to_user = username,
            app = app,
            msg_type = msg_type,
            detail = json.dumps(detail)
        )

    def count_unseen_app_notifications(self, app, username):
        return self.filter(
            app = app,
            to_user = username,
            seen = False
        ).count()

    def set_all_seen(self, app, username):
        return self.filter(
            app = app,
            to_user = username,
            seen = False
        ).update(seen = True)


class DTableAppNotifications(models.Model):
    to_user = models.CharField(max_length=255, db_index=True) # to whom
    app = models.ForeignKey(DTableExternalApps, on_delete=models.CASCADE, db_index=True, db_column='app_id')
    msg_type = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    detail = models.TextField() # comments detail
    seen = models.BooleanField(default=False)

    objects = DTableAppNotificationManager()

    class Meta:
        db_table = 'dtable_app_notifications'


    def handle_see(self):
        if not self.seen:
            self.seen = True
            self.save()
        return self

    def to_dict(self):
        detail = json.loads(self.detail)
        
        return {
            'id': self.id,
            'username': self.to_user,
            'msg_type': self.msg_type,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'detail': detail,
            'seen': 1 if self.seen else 0
        }

class DTableAppSnapshotManager(models.Manager):

    def get_app_latest_snapshot(self, app):
        return self.filter(app=app).order_by('-id').first()

    def add_snapshot(self, app, notes=''):
        ts = int(time.time())
        app_version = app.version
        app_config = app.app_config
        new_snapshot = self.create(
            app = app,
            app_version = app_version,
            app_config = app_config,
            created_at=ts,
            notes = notes
        )
        return new_snapshot


class DTableAppSnapshot(models.Model):
    app = models.ForeignKey(DTableExternalApps, on_delete=models.CASCADE, db_index=True, db_column='app_id', related_name='snapshots')
    created_at = models.BigIntegerField()
    app_version = models.IntegerField(null=False)
    app_config = models.TextField()
    notes = models.CharField(max_length=255, default='')
    objects = DTableAppSnapshotManager()

    class Meta:
        db_table = 'dtable_app_snapshot'
        unique_together = (('app', 'app_version'),)

    def to_dict(self):
        return {
            'id': self.id,
            'created_at': timestamp_to_isoformat_timestr(self.created_at),
            'version': self.app_version,
            'notes': self.notes,
        }


class DTableAppRowCommentManager(models.Manager):

    def add_comment(self, app, dtable_uuid, username, comment, table_id, row_id):
        return self.create(
            author = username,
            comment = comment,
            app = app,
            dtable_uuid = dtable_uuid,
            table_id = table_id,
            row_id = row_id
        )

    def list_row_comments(self, app, dtable_uuid, table_id, row_id, start, end):
        qset = self.filter(
            app = app,
            dtable_uuid = dtable_uuid,
            table_id = table_id,
            row_id = row_id,
        )
        comment_count = qset.count()
        comment_list = qset[start: end]
        return comment_list, comment_count
    


class DTableAppRowComments(models.Model):
    author = models.CharField(max_length=255)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    app = models.ForeignKey(DTableExternalApps, on_delete=models.CASCADE, db_column='app_id')
    dtable_uuid = models.CharField(max_length=255)
    table_id = models.CharField(max_length=255)
    row_id = models.CharField(max_length=36)
    resolved = models.BooleanField(default=False)

    objects = DTableAppRowCommentManager()

    class Meta:
        db_table = 'dtable_app_row_comments'
        index_together = (('dtable_uuid', 'table_id', 'row_id'),)


    @property
    def notes(self):
        user_info = get_common_user_info(self.author)
        return {
            'id': self.pk,
            'author': self.author,
            'author_name': user_info.get('name'),
            'author_avatar_url': user_info.get('avatar_url'),
            'comment': self.comment,
            'row_id': self.row_id,
            'table_id': self.table_id,
            'dtable_uuid': self.dtable_uuid,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
        }

    def to_dict(self):
        user_info = get_common_user_info(self.author)
        return {
            'id': self.pk,
            'author': user_info.get('email'),
            'name': user_info.get('name'),
            'avatar_url': user_info.get('avatar_url'),
            'comment': self.comment,
            'row_id': self.row_id,
            'table_id': self.table_id,
            'resolved': self.resolved,
            'dtable_uuid': self.dtable_uuid,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
        }

class DTableAppRowParticipantManager(models.Manager):

    def get_participant_by_id(self, participant_id):
        try:
            return self.get(
                pk = participant_id
            )
        except self.model.DoesNotExist:
            return None


    def add_participant(self, app, dtable_uuid, username, table_id, row_id):
        return self.get_or_create(
            app=app,
            dtable_uuid=dtable_uuid,
            app_user=username,
            table_id=table_id,
            row_id=row_id,
        )

    def list_participants(self, app, dtable_uuid, table_id, row_id):
        return self.filter(
            app = app,
            dtable_uuid = dtable_uuid,
            table_id = table_id,
            row_id = row_id,
        )


class DTableAppRowParticipants(models.Model):
    app = models.ForeignKey(DTableExternalApps, on_delete=models.CASCADE)
    app_user = models.CharField(max_length=255, db_index=True)
    dtable_uuid = models.CharField(max_length=255)
    table_id = models.CharField(max_length=255)
    row_id = models.CharField(max_length=36)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = DTableAppRowParticipantManager()

    class Meta:
        db_table = 'dtable_app_row_participants'
        index_together = (('dtable_uuid', 'table_id', 'row_id'),)

    def to_dict(self):
        app_user_info_dict = get_common_user_info(self.app_user)
        app_user_info_dict['id'] = self.pk
        app_user_info_dict['table_id'] = self.table_id
        app_user_info_dict['row_id'] = self.row_id
        app_user_info_dict['dtable_uuid'] = self.dtable_uuid

        return app_user_info_dict

class DtableAppFoldersManager(models.Manager):
    def get_non_duplicated_name(self, name, username, folder_type):
        folders = super(DtableAppFoldersManager, self).filter(username=username, name__startswith=name, folder_type=folder_type)
        existed_names = [f.name for f in folders]
        if not existed_names or name not in existed_names:
            return name
        return get_no_duplicate_obj_name(name, existed_names)

class DtableAppFolders(models.Model):
    name = models.CharField(max_length=255, null=False)
    username = models.CharField(max_length=255, null=False)
    folder_type = models.CharField(max_length=255, null=False)

    objects = DtableAppFoldersManager()

    class Meta:
        db_table = 'dtable_app_folders'
        unique_together = [('username', 'name', 'folder_type')]

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'username': self.username,
            'folder_type': self.folder_type
        }
    
class DtableAppFolderItems(models.Model):
    folder_id = models.IntegerField(null=False)
    app_id = models.IntegerField(null=False)

    class Meta:
        db_table = 'dtable_app_folder_items'
        unique_together = [('folder_id', 'app_id')]

    def to_dict(self):
        return {
            'folder_id': self.folder_id,
            'app_id': self.app_id,
        }


class DTableAPPAnonymousAccessPassword(models.Model):
    app = models.ForeignKey(DTableExternalApps, on_delete=models.CASCADE)
    password = models.CharField(max_length=256, null=True)

    class Meta:
        db_table = 'dtable_app_anonymous_access_password'


@receiver(external_app_deleted)
def external_app_deleted_cb(sender, **kwargs):
    app_id = kwargs.get('app_id')
    app_type = kwargs.get('app_type')
    if not (app_type and app_id):
        return
    if app_type != 'universal-app':
        return
    DTableAppInviteLinks.objects.filter(app_id=app_id).delete()
    DTableAppUserSync.objects.filter(app_id=app_id).delete()
    DTableAppUsers.objects.filter(app_id=app_id).delete()
    DTableAppRoles.objects.filter(app_id=app_id).delete()
    DTableAppSnapshot.objects.filter(app_id=app_id).delete()
    DTableAPPAnonymousAccessPassword.objects.filter(app_id=app_id).delete()

@receiver(new_app_row_comment)
def new_app_row_comment_cb(sender, **kwargs):
    app = kwargs.get('app')
    username = kwargs.get('username')
    row_participants = kwargs.get('row_participants')
    detail = kwargs.get('detail')

    for participant in row_participants:
        app_username = participant.app_user
        if app_username == username: # ignore notification to self
            continue

        DTableAppNotifications.objects.add_notification(
            app = app,
            username = app_username,
            detail = detail,
            msg_type = 'row_comments'
        )
