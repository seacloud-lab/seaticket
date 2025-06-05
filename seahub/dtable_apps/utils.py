from seahub.dtable.constants import ColumnTypes


SUPPORT_SEARCH_COLUMN_TYPES = [
    ColumnTypes.NUMBER,
    ColumnTypes.DATE,
    ColumnTypes.TEXT,
    ColumnTypes.SINGLE_SELECT,
    ColumnTypes.MULTIPLE_SELECT,
    ColumnTypes.DURATION,
    ColumnTypes.EMAIL,
    ColumnTypes.AUTO_NUMBER,
    ColumnTypes.CTIME,
    ColumnTypes.MTIME,
    ColumnTypes.LINK,
    ColumnTypes.DEPARTMENT_SINGLE_SELECT
]


def is_filter_empty(filter_item, column):
    """judge filter empty

    :params filter_item: filter
    :params column: column of table

    Return: True or False
    """
    filter_term = filter_item.get('filter_term')
    filter_predicate = filter_item.get('filter_predicate')
    filter_term_modifier = filter_item.get('filter_term_modifier')

    if filter_predicate in ('is_empty', 'is_not_empty'):
        return False

    if column['type'] in (
        ColumnTypes.NUMBER,
        ColumnTypes.DURATION
    ):
        if filter_term == 0:
            return False
        return not filter_term

    if column['type'] in (
        ColumnTypes.TEXT,
        ColumnTypes.SINGLE_SELECT,
        ColumnTypes.MULTIPLE_SELECT,
        ColumnTypes.EMAIL,
        ColumnTypes.AUTO_NUMBER
    ):
        return not filter_term

    elif column['type'] in (
        ColumnTypes.DATE,
        ColumnTypes.CTIME,
        ColumnTypes.MTIME
    ):
        if filter_predicate == 'is_within':
            if filter_term_modifier in (
                'the_past_week',
                'the_past_month',
                'the_past_year',
                'this_week',
                'this_month',
                'this_year',
                'the_next_week',
                'the_next_month',
                'the_next_year'
            ):
                return False
            elif filter_term_modifier in (
                'the_next_numbers_of_days',
                'the_past_numbers_of_days'
            ):
                return filter_term is None
        elif filter_predicate in (
            'is',
            'is_not',
            'is_before',
            'is_after',
            'is_on_or_before',
            'is_on_or_after'
        ):
            if filter_term_modifier in (
                'today',
                'tomorrow',
                'yesterday',
                'one_week_ago',
                'one_week_from_now',
                'one_month_ago',
                'one_month_from_now'
            ):
                return False
            elif filter_term_modifier in (
                'number_of_days_ago',
                'number_of_days_from_now'
            ):
                return filter_term is None
            elif filter_term_modifier == 'exact_date':
                return not filter_term
        return not filter_term

    return False
