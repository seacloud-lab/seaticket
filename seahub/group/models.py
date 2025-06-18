# -*- coding: utf-8 -*-
import logging

from django.db import models

logger = logging.getLogger(__name__)


class GroupUserManager(models.Manager):
    def remove_group_user(self, username):
        self.filter(user_name=username).delete()


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
