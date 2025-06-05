# -*- coding: utf-8 -*-
import uuid
import logging

from django.db import models

from seahub.utils import gen_token
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.settings import DTABLE_WEB_SERVICE_URL

logger = logging.getLogger(__name__)


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
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'created_by': email2nickname(self.created_by),
            'link': f"{DTABLE_WEB_SERVICE_URL.rstrip('/')}/group-invite/{self.token}/",
        }
        return result


class GroupIDLDAPUUIDPairManager(models.Manager):
    def add_group_id_uuid_pair(self, group_id, group_uuid):
        try:
            group_id_uuid_pair = self.model(group_id=group_id, group_uuid=group_uuid)
            group_id_uuid_pair.save()
            return group_id_uuid_pair
        except Exception as e:
            logger.error(e)
            return None


class GroupIDLDAPUUIDPair(models.Model):
    id = models.BigAutoField(primary_key=True)
    group_id = models.IntegerField(unique=True)
    group_uuid = models.UUIDField(unique=True, default=uuid.uuid4)

    objects = GroupIDLDAPUUIDPairManager()

    class Meta:
        db_table = 'group_id_ldap_uuid_pair'
