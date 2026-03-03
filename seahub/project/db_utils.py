import datetime
from django.db.models import Sum, Aggregate, CharField
from seahub.project.models import AIUsageStatistics
from seahub.chats.utils import get_label_from_model_id

class GroupConcat(Aggregate):
    function = 'GROUP_CONCAT'
    template = '%(function)s(%(distinct)s%(expressions)s%(separator)s)'
    
    def __init__(self, expression, distinct=False, separator=',', **extra):
        super().__init__(
            expression,
            distinct='DISTINCT ' if distinct else '',
            separator=f" SEPARATOR '{separator}'" if separator != ',' else '',
            output_field=CharField(),
            **extra
        )

def query_ai_statistics_overview(group_by, date_range, org_id=None):
    date_begin, date_end = date_range

    query_kwargs = {
        'date__gte': date_begin,
        'date__lte': date_end,
    }
    if org_id:
        query_kwargs['org_id'] = org_id
    if group_by == 'group_id':
        query_kwargs['group_id__gte'] = 0
    elif group_by == 'org_id':
        query_kwargs['org_id__gte'] = 0
    query_set = AIUsageStatistics.objects.filter(**query_kwargs)
    if group_by == 'username':
        query_set = query_set.exclude(username='seaqa-indexer')
    query_set = query_set.values(
        group_by
    ).annotate(
        total_cost=Sum('cost')
    ).order_by(
        '-total_cost'
    ).values(
        group_by,
        'org_id',
        'total_cost'
    )

    return query_set

def query_ai_statistics_model(group_by, condition):
    query_kwargs = {}
    if 'username' in condition:
        query_kwargs['username'] = condition['username']
    if 'project_uuid' in condition:
        query_kwargs['project_uuid'] = condition['project_uuid'].replace('-', '')
    if 'group_id' in condition:
        query_kwargs['group_id'] = int(condition['group_id'])
    if 'org_id' in condition:
        query_kwargs['org_id'] = int(condition['org_id'])
    query_set = AIUsageStatistics.objects.filter(
        **query_kwargs
    ).values(
        group_by
    ).annotate(
        model_list=GroupConcat('model')
    ).values(
        'model_list'
    )

    model_id_list = []
    for record in query_set:
        model_id_list += record['model_list'].split(',')
    
    models = {
        get_label_from_model_id(model_id): model_id
        for model_id in set(model_id_list)
    }

    return models

def query_ai_statistics_detail(group_by, condition, model_list):
    query_kwargs = {}
    if 'username' in condition:
        query_kwargs['username'] = condition['username']
    if 'project_uuid' in condition:
        query_kwargs['project_uuid'] = condition['project_uuid'].replace('-', '')
    if 'group_id' in condition:
        query_kwargs['group_id'] = int(condition['group_id'])
    if 'org_id' in condition:
        query_kwargs['org_id'] = int(condition['org_id'])
    if (start_date := condition.get('start_date')) and (end_date := condition.get('end_date')):
        query_kwargs['date__gte'] = datetime.datetime.strptime(start_date.split('T')[0], '%Y-%m-%d').date()
        query_kwargs['date__lte'] = datetime.datetime.strptime(end_date.split('T')[0], '%Y-%m-%d').date()

    query_kwargs = {
        **query_kwargs,
        'model__in': model_list,
    }
    query_set = AIUsageStatistics.objects.filter(
        **query_kwargs
    ).values(
        group_by
    ).annotate(
        total_input_tokens=Sum('input_tokens'),
        total_output_tokens=Sum('output_tokens'),
        total_cost=Sum('cost')
    ).order_by(
        '-total_cost'
    ).values(
        group_by,
        'org_id',
        'total_input_tokens',
        'total_output_tokens',
        'total_cost'
    )

    return query_set
