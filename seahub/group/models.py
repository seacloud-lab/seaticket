# -*- coding: utf-8 -*-
import logging
import time

from django.db import models

from seahub.utils import gen_token
from seahub.settings import SEAQA_WEB_SERVICE_URL
from seahub.base.templatetags.seahub_tags import email2nickname

logger = logging.getLogger(__name__)


class GroupUserManager(models.Manager):
    def remove_group_user(self, username):
        self.filter(user_name=username).delete()

    def is_group_user(self, group_id, username):
        return self.filter(group_id=group_id, user_name=username).exists()
    
    def group_add_member(self, group_id, username, is_staff=False):
        return self.create(group_id=group_id, user_name=username, is_staff=is_staff)

    def group_set_admin(self, group_id, username):
        self.filter(group_id=group_id, user_name=username).update(is_staff=True)

    def group_unset_admin(self, group_id, username):
        self.filter(group_id=group_id, user_name=username).update(is_staff=False)


class GroupUser(models.Model):
    group_id = models.IntegerField()
    user_name = models.CharField(max_length=255)
    is_staff = models.BooleanField()

    objects = GroupUserManager()

    class Meta:
        db_table = 'group_user'


class GroupManager(models.Manager):
    def remove_group(self, group_id):
        self.filter(group_id=group_id).delete()

    def get_group(self, group_id):
        try:
            return super(GroupManager, self).get(group_id=group_id)
        except Group.DoesNotExist:
            return None

    def create_group(self, group_name, username, parent_group_id=0):
        ctime = int(time.time_ns() / 1000)
        return self.create(group_name=group_name, creator_name=username, parent_group_id=parent_group_id, timestamp=ctime)

    def search_groups(self, query_string):
        return self.filter(group_name__icontains=query_string)

    def set_group_creator(self, group_id, username):
        self.filter(group_id=group_id).update(creator_name=username)
    
    def set_group_name(self, group_id, group_name):
        self.filter(group_id=group_id).update(group_name=group_name)

    def get_personal_groups_by_user(self, username):
        user_groups = GroupUser.objects.filter(user_name=username)
        return self.filter(group_id__in=[g.group_id for g in user_groups])


class Group(models.Model):
    group_id = models.BigAutoField(primary_key=True)
    group_name = models.CharField(max_length=255)
    creator_name = models.CharField(max_length=255)
    timestamp = models.BigIntegerField()
    type = models.CharField(max_length=32)
    parent_group_id = models.IntegerField()

    objects = GroupManager()

    class Meta:
        db_table = 'group'


class GroupInviteLinkModelManager(models.Manager):
    def create_link(self, group_id, email):
        token = gen_token(max_length=8)
        while self.model.objects.filter(token=token).exists():
            token = gen_token(max_length=8)

        group_invite_link = super(GroupInviteLinkModelManager, self).create(
            group_id=group_id, token=token, created_by=email)
        return group_invite_link


class GroupInviteLinkModel(models.Model):
    token = models.CharField(max_length=40, db_index=True)
    group_id = models.IntegerField(db_index=True, null=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255)

    objects = GroupInviteLinkModelManager()

    class Meta:
        db_table = 'group_invite_link'

    def to_dict(self):
        result = {
            'id': self.pk,
            'token': self.token,
            'group_id': self.group_id,
            'created_at': self.created_at,
            'created_by': email2nickname(self.created_by),
            'link': f"{SEAQA_WEB_SERVICE_URL.rstrip('/')}/group-invite/{self.token}/",
        }
        return result
