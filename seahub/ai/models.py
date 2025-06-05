# Copyright (c) 2012-2017 Seafile Ltd.
from django.db import models
from seahub.utils.timeutils import datetime_to_isoformat_timestr


class AIAssistantOwnerManager(models.Manager):

    def get_assistants_by_owners(self, owners):
        return self.filter(owner__in=owners)

    def add(self, assistant_uuid, owner):
        obj = self.model(
            assistant_uuid=assistant_uuid,
            owner=owner
        )
        obj.save()
        return obj


class AIAssistantOwner(models.Model):
    assistant_uuid = models.CharField(max_length=36, db_index=True)
    owner = models.CharField(max_length=255, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    objects = AIAssistantOwnerManager()

    class Meta:
        db_table = 'ai_assistant_owner'

    def to_dict(self):
        return {
            'id': self.pk,
            'assistant_uuid': self.assistant_uuid,
            'owner': self.owner,
            'created_at': datetime_to_isoformat_timestr(self.created_at)
        }


class StatsAIByTeam(models.Model):
    org_id = models.BigIntegerField(null=False)
    month = models.DateField(null=False, db_index=True)
    model = models.CharField(max_length=100, null=False)
    input_tokens = models.IntegerField()
    output_tokens = models.IntegerField()
    cost = models.FloatField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        db_table = 'stats_ai_by_team'
        unique_together = (('org_id', 'month', 'model'),)


class StatsAIByOwner(models.Model):
    owner_id = models.CharField(max_length=255, null=False)
    month = models.DateField(null=False, db_index=True)
    model = models.CharField(max_length=100, null=False)
    input_tokens = models.IntegerField()
    output_tokens = models.IntegerField()
    cost = models.FloatField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        db_table = 'stats_ai_by_owner'
        unique_together = (('owner_id', 'month', 'model'),)
