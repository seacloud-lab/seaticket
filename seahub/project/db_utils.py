from django.db.models import Sum
from seahub.project.models import AIUsageStatistics
from seahub.project.utils import convert_cost_to_credit

def query_ai_statistics_overview(group_by, date_range, org_id=None):
    """
    sql:
    SELECT `{group_by}`, SUM(`cost`) as `total_credit_used` 
    FROM `ai_usage_statistics` 
    WHERE `date` >= '{date_begin}' and `date` <= '{date_end}'
    GROUP BY `{group_by}`
    ORDER BY `total_credit_used` DESC

    if group_by in (group_id, org_id) => add a where condition with group_id >= 0 or org_id >= 0
    if has org_id => add a where condition with org_id = ... 
    """
    date_begin, date_end = date_range

    query_kwargs = {
        'date__gte': date_begin,
        'date__lte': date_end,
    }
    if group_by == 'group_id':
        query_kwargs['group_id__gte'] = 0
    elif group_by == 'org_id':
        query_kwargs['org_id__gte'] = 0
    if org_id:
        query_kwargs['org_id'] = org_id
    query_set = AIUsageStatistics.objects.filter(**query_kwargs)
    if group_by == 'username':
        query_set = query_set.exclude(username='seaqa-indexer').exclude(username='agent')
    query_set = query_set.values(
        group_by
    ).annotate(
        total_credit_used=convert_cost_to_credit(Sum('cost'))
    ).order_by(
        '-total_credit_used'
    ).values(
        group_by,
        'org_id',
        'total_credit_used'
    )

    return query_set


def query_ai_statistics_detail(group_by, date_range, condition, scenarios=None):
    """
    sql:
    SELECT `date`, SUM(`input_tokens`) as `total_input_tokens`, SUM(`output_tokens`) as `total_output_tokens`, SUM(`cost`) as `total_credit_used`
    FROM `ai_usage_statistics` 
    WHERE `date` >= '{date_begin}' and `date` <= '{date_end}' and `condition_field` = 'condition_value'
    GROUP BY `{group_by}`
    ORDER BY `{date or total_credit_used}`

    if has model_list => add a new condition of `model` in where condition
    if has scenarios => add a new condition of `scenario` in where condition
    """
    date_begin, date_end = date_range

    query_kwargs = {
        'date__gte': date_begin,
        'date__lte': date_end,
    }
    if 'username' in condition:
        query_kwargs['username'] = condition['username']
    if 'project_uuid' in condition:
        query_kwargs['project_uuid'] = condition['project_uuid'].replace('-', '')
    if 'group_id' in condition:
        query_kwargs['group_id'] = int(condition['group_id'])
    if 'org_id' in condition:
        query_kwargs['org_id'] = int(condition['org_id'])
    if scenarios:
        query_kwargs['scenario__in'] = scenarios

    query_set = AIUsageStatistics.objects.filter(
        **query_kwargs
    ).values(
        group_by
    ).annotate(
        total_input_tokens=Sum('input_tokens'),
        total_output_tokens=Sum('output_tokens'),
        total_credit_used=convert_cost_to_credit(Sum('cost'))
    ).order_by(
        'date' if group_by == 'date' else '-total_credit_used'
    ).values(
        group_by,
        'org_id',
        'total_input_tokens',
        'total_output_tokens',
        'total_credit_used'
    )
    if group_by == 'username':
        query_set = query_set.exclude(username='seaqa-indexer').exclude(username='agent')

    return query_set
