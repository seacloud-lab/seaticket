from django.db.models import Sum
from seahub.project.models import AIUsageStatistics
from seahub.project.utils import convert_cost_to_credit

def query_ai_statistics_overview(group_by, date_range, org_id=None):
    """
    sql:
    SELECT `{group_by}`, SUM(`cost`) AS `total_credit_used`
    FROM `ai_usage_statistics`
    WHERE `date` >= '{date_begin}' AND `date` <= '{date_end}'
    GROUP BY `{group_by}`
    ORDER BY `total_credit_used` DESC

    if group_by == 'owner' => add `owner IS NOT NULL`
    if group_by == 'group_id' => add `group_id >= 0`
    if group_by == 'org_id' => add `org_id >= 0` (params org_id not set)
    if group_by == 'project_uuid' => additionally select `owner`, `group_id`
    if org_id is provided => add `org_id = {org_id}` (remove the above `org_id >= 0`)
    """
    date_begin, date_end = date_range

    query_kwargs = {
        'date__gte': date_begin,
        'date__lte': date_end,
    }
    addition_value_columns = []
    if group_by == 'owner':
        query_kwargs['owner__isnull'] = False
    elif group_by == 'group_id':
        query_kwargs['group_id__gte'] = 0
    elif group_by == 'org_id':
        if not org_id:
            query_kwargs['org_id__gte'] = 0
    elif group_by == 'project_uuid':
        addition_value_columns = [
            'owner',
            'group_id'
        ]
    elif group_by != 'scenario':
        raise AssertionError(f'Invalid group_by type: {group_by}')
    if org_id:
        query_kwargs['org_id'] = org_id
    query_set = AIUsageStatistics.objects.filter(**query_kwargs)
    query_set = query_set.values(
        group_by
    ).annotate(
        total_credit_used=convert_cost_to_credit(Sum('cost'))
    ).order_by(
        '-total_credit_used'
    ).values(
        group_by,
        'org_id',
        'total_credit_used',
        *addition_value_columns
    )

    return query_set


def query_ai_statistics_detail(group_by, date_range, condition, scenarios=None):
    """
    sql:
    SELECT `{group_by}`, SUM(`input_tokens`) AS `total_input_tokens`, SUM(`output_tokens`) AS `total_output_tokens`, SUM(`cost`) AS `total_credit_used`
    FROM `ai_usage_statistics`
    WHERE `date` >= '{date_begin}' AND `date` <= '{date_end}'
      AND `{condition_key}` = '{condition_value}'
    GROUP BY `{group_by}`
    ORDER BY `date ASC` (if group_by == 'date') OR `total_credit_used DESC` (otherwise)

    condition dict supports keys: owner, project_uuid (hyphens stripped), group_id, org_id
    if scenarios is provided => add `scenario IN (...)`
    """
    date_begin, date_end = date_range

    query_kwargs = {
        'date__gte': date_begin,
        'date__lte': date_end,
    }
    if 'owner' in condition:
        query_kwargs['owner'] = condition['owner']
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

    return query_set
