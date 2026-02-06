from django.db.models import Sum, Aggregate, CharField
from seahub.project.models import AIUsageStatistics

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

def query_ai_statistics_data(group_by, date_query={}, org_id=None):
    model_list_query_set = AIUsageStatistics.objects
    if org_id:
        model_list_query_set = model_list_query_set.filter(org_id=org_id)
    model_list_query_set = model_list_query_set.values(
        group_by
    ).annotate(
        model_list=GroupConcat('model')
    ).values(
        group_by,
        'model_list'
    )

    if org_id:
        date_query['org_id'] = org_id
    total_cost_query_set = AIUsageStatistics.objects.filter(
        **date_query
    ).values(
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

    # Use useful_group_by_set to avoid performance issues caused by generating map.
    useful_group_by_set = set([item[group_by] for item in total_cost_query_set])
    group_by_to_model_list_map = {
        item[group_by]: list(set(item['model_list'].split(',')))
        for item in model_list_query_set if item[group_by] in useful_group_by_set
    }
    

    records = []
    for item in total_cost_query_set:
        record = {
            'total_cost': item['total_cost'],
            'org_id': item['org_id'],
            'model_list': group_by_to_model_list_map.get(item[group_by], [])
        }
        record[group_by] = item[group_by]
        records.append(record)
    return records
