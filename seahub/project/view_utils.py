import logging
from datetime import datetime, timezone, timedelta
import pytz
from dateutil.relativedelta import relativedelta

from django.db.models import Q

from seahub.project.constants import FilterPredicateTypes, FilterTermModifier, PropertyTypes


logger = logging.getLogger(__name__)


class ColumnFilterInvalidError(Exception):
    def __init__(self, column_name, column_type, filter_predicate, support_filter_predicates, msg):
        self.column_name = column_name
        self.column_type = column_type
        self.filter_predicate = filter_predicate
        self.support_filter_predicates = support_filter_predicates
        self.msg = msg


class Operator(object):

    def __init__(self, column, filter_item):
        self.column = column
        self.filter_item = filter_item

        self.column_name = ''
        self.filter_term = ''

        self.filter_predicate = ''
        self.filter_term_modifier = ''
        self.column_type = ''
        self.column_data = {}

        self.init()

    def init(self):
        self.column_name = self.column.get('name', '')
        self.column_type = self.column.get('type', '')
        self.column_data = self.column.get('data', {})
        self.filter_predicate = self.filter_item.get('filter_predicate', '')
        self.filter_term = self.filter_item.get('filter_term', '')
        self.filter_term_modifier = self.filter_item.get('filter_term_modifier', '')

    def op_is(self):
        if not self.filter_term:
            return ""
        return "`%s` %s '%s'" % (
            self.column_name,
            '=',
            self.filter_term
        )

    def op_is_not(self):
        if not self.filter_term:
            return ""
        return "`%s` %s '%s'" % (
            self.column_name,
            '<>',
            self.filter_term
        )

    def op_contains(self):
        if not self.filter_term:
            return ""
        return "`%s` %s '%%%s%%'" % (
            self.column_name,
            'like',
            self.filter_term.replace('\\', '\\\\'), # special characters require translation
        )

    def op_does_not_contain(self):
        if not self.filter_term:
            return ''
        return "`%s` %s '%%%s%%'" % (
            self.column_name,
            'not like',
            self.filter_term.replace('\\', '\\\\') # special characters require translation
        )

    def op_equal(self):
        if not self.filter_term and self.filter_term != 0:
            return ''
        return "`%(column_name)s` = %(value)s" % ({
            'column_name': self.column_name,
            'value': self.filter_term
        })

    def op_not_equal(self):
        if not self.filter_term and self.filter_term != 0:
            return ''
        return "`%(column_name)s` <> %(value)s" % ({
            'column_name': self.column_name,
            'value': self.filter_term
        })

    def op_less(self):
        if not self.filter_term and self.filter_term != 0:
            return ''
        return "`%(column_name)s` < %(value)s" % ({
            'column_name': self.column_name,
            'value': self.filter_term
        })

    def op_less_or_equal(self):
        if not self.filter_term and self.filter_term != 0:
            return ''
        return "`%(column_name)s` <= %(value)s" % ({
            'column_name': self.column_name,
            'value': self.filter_term
        })

    def op_greater(self):
        if not self.filter_term and self.filter_term != 0:
            return ''
        return "`%(column_name)s` > %(value)s" % ({
            'column_name': self.column_name,
            'value': self.filter_term
        })

    def op_greater_or_equal(self):
        if not self.filter_term and self.filter_term != 0:
            return ''
        return "`%(column_name)s` >= %(value)s" % ({
            'column_name': self.column_name,
            'value': self.filter_term
        })

    def op_is_empty(self):
        return "`%(column_name)s` is null" % ({
            'column_name': self.column_name
        })

    def op_is_not_empty(self):
        return "`%(column_name)s` is not null" % ({
            'column_name': self.column_name
        })

    def op_is_current_user_id(self):
        if not self.filter_term:
            return "(`%s`IS NULL AND `%s` IS NOT NULL)" % (
                self.column_name,
                self.column_name
            )
        return "`%s` %s '%s'" % (
            self.column_name,
            '=',
            self.filter_term
        )


class DateOperator(Operator):
    SUPPORT_FILTER_PREDICATE = [
        FilterPredicateTypes.IS,
        FilterPredicateTypes.IS_NOT,
        FilterPredicateTypes.IS_AFTER,
        FilterPredicateTypes.IS_BEFORE,
        FilterPredicateTypes.IS_ON_OR_BEFORE,
        FilterPredicateTypes.IS_ON_OR_AFTER,
        FilterPredicateTypes.EMPTY,
        FilterPredicateTypes.NOT_EMPTY,
        FilterPredicateTypes.IS_WITHIN,
    ]
    
    def __init__(self, column, filter_item):
        super(DateOperator, self).__init__(column, filter_item)

    def _get_end_day_of_month(self, year, month):
        days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):
            days[1] = 29

        return days[month - 1]

    def _format_date(self, dt):
        if dt:
            return dt.strftime("%Y-%m-%d")

    def _format_to_utc_date(self, dt):
        if dt:
            end_date = dt.astimezone(pytz.UTC)

            return end_date.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")

    def get_date(self, filter_term_modifier, filter_term=None):
        today = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0)
        year = today.year

        if filter_term_modifier == FilterTermModifier.TODAY:
            return today, None

        if filter_term_modifier == FilterTermModifier.TOMORROW:
            tomorrow = today + timedelta(days=1)
            return tomorrow, None

        if filter_term_modifier == FilterTermModifier.YESTERDAY:
            yesterday = today - timedelta(days=1)
            return yesterday, None

        if filter_term_modifier == FilterTermModifier.ONE_WEEK_AGO:
            one_week_ago = today - timedelta(days=7)
            return one_week_ago, None

        if filter_term_modifier == FilterTermModifier.ONE_WEEK_FROM_NOW:
            one_week_from_now = today + timedelta(days=7)
            return one_week_from_now, None

        if filter_term_modifier == FilterTermModifier.ONE_MONTH_AGO:
            one_month_ago = today - relativedelta(months=1)
            return one_month_ago, None

        if filter_term_modifier == FilterTermModifier.ONE_MONTH_FROM_NOW:
            one_month_from_now = today + relativedelta(months=1)
            return one_month_from_now, None

        if filter_term_modifier == FilterTermModifier.NUMBER_OF_DAYS_AGO:
            try:
                filter_term = int(filter_term)
            except:
                logger.debug(
                    "filter_term is invalid, please assign an integer value of days to filter_term")
                return None, None
            try:
                days_ago = today - timedelta(days=filter_term)
            except Exception as e:
                logger.error(e)
                return None, None
            return days_ago, None

        if filter_term_modifier == FilterTermModifier.NUMBER_OF_DAYS_FROM_NOW:
            try:
                filter_term = int(filter_term)
            except:
                logger.debug(
                    "filter_term is invalid, please assign an integer value of days to filter_term")
                return None, None
            try:
                days_after = today + timedelta(days=filter_term)
            except Exception as e:
                logger.error(e)
                return None, None
            return days_after, None

        if filter_term_modifier == FilterTermModifier.EXACT_DATE:
            try:
                return datetime.strptime(filter_term, "%Y-%m-%d"), None
            except Exception as e:
                logger.error(e)
                return None, None

        if filter_term_modifier == FilterTermModifier.THE_PAST_WEEK:
            week_day = today.isoweekday()  # 1-7
            start_date = today - timedelta(days=(week_day + 6))
            end_date = today - timedelta(days=week_day)
            return start_date, end_date

        if filter_term_modifier == FilterTermModifier.THIS_WEEK:
            week_day = today.isoweekday()
            start_date = today - timedelta(days=week_day - 1)
            end_date = today + timedelta(days=7 - week_day)
            return start_date, end_date

        if filter_term_modifier == FilterTermModifier.THE_NEXT_WEEK:
            week_day = today.isoweekday()
            start_date = today + timedelta(days=8 - week_day)
            end_date = today + timedelta(days=14 - week_day)
            return start_date, end_date

        if filter_term_modifier == FilterTermModifier.THE_PAST_MONTH:
            one_month_ago = today - relativedelta(months=1)
            one_month_ago_year = one_month_ago.year
            one_month_ago_month = one_month_ago.month
            one_month_age_end_day = self._get_end_day_of_month(
                one_month_ago_year, one_month_ago_month)
            start_date = datetime(one_month_ago_year, one_month_ago_month, 1)
            end_date = datetime(one_month_ago_year,
                                one_month_ago_month, one_month_age_end_day)
            return start_date, end_date

        if filter_term_modifier == FilterTermModifier.THIS_MONTH:
            current_month = today.month
            current_year = today.year
            current_month_end_day = self._get_end_day_of_month(
                current_year, current_month)
            start_date = datetime(current_year, current_month, 1)
            end_date = datetime(current_year, current_month,
                                current_month_end_day)
            return start_date, end_date

        if filter_term_modifier == FilterTermModifier.THE_NEXT_MONTH:
            next_month = today + relativedelta(months=1)
            next_month_year = next_month.year
            next_month_month = next_month.month
            next_month_end_day = self._get_end_day_of_month(
                next_month_year, next_month_month)
            start_date = datetime(next_month_year, next_month_month, 1)
            end_date = datetime(
                next_month_year, next_month_month, next_month_end_day)
            return start_date, end_date

        if filter_term_modifier == FilterTermModifier.THE_PAST_YEAR:
            last_year = year - 1
            start_date = datetime(last_year, 1, 1)
            end_date = datetime(last_year, 12, 31)
            return start_date, end_date

        if filter_term_modifier == FilterTermModifier.THIS_YEAR:
            start_date = datetime(year, 1, 1)
            end_date = datetime(year, 12, 31)
            return start_date, end_date

        if filter_term_modifier == FilterTermModifier.THE_NEXT_YEAR:
            next_year = year + 1
            start_date = datetime(next_year, 1, 1)
            end_date = datetime(next_year, 12, 31)
            return start_date, end_date

        if filter_term_modifier == FilterTermModifier.THE_NEXT_NUMBERS_OF_DAYS:
            try:
                filter_term = int(filter_term)
            except:
                logger.debug(
                    "filter_term is invalid, please assign an integer value of days to filter_term")
                return None, None
            try:
                end_date = today + timedelta(days=filter_term)
            except Exception as e:
                logger.error(e)
                return None, None
            return today, end_date

        if filter_term_modifier == FilterTermModifier.THE_PAST_NUMBERS_OF_DAYS:
            try:
                filter_term = int(filter_term)
            except:
                logger.debug(
                    "filter_term is invalid, please assign an integer value of days to filter_term")
                return None, None
            try:
                start_date = today - timedelta(days=filter_term)
            except Exception as e:
                logger.error(e)
                return None, None
            return start_date, today

        return None, None

    def is_need_filter_term(self):
        if self.filter_term_modifier in [
            FilterTermModifier.NUMBER_OF_DAYS_AGO,
            FilterTermModifier.NUMBER_OF_DAYS_FROM_NOW,
            FilterTermModifier.THE_NEXT_NUMBERS_OF_DAYS,
            FilterTermModifier.THE_PAST_NUMBERS_OF_DAYS,
            FilterTermModifier.EXACT_DATE
        ]:
            return True
        return False
    
    def op_is(self):
        if self.is_need_filter_term() and not self.filter_term and self.filter_term != 0:
            return ''
        date, _ = self.get_date(self.filter_term_modifier, self.filter_term)
        if not date:
            return ""
        next_date = self._format_date(date + timedelta(days=1))
        target_date = self._format_date(date)
        return "`%(column_name)s` >= '%(target_date)s' and `%(column_name)s` < '%(next_date)s'" % ({
            "column_name": self.column_name,
            "target_date": target_date,
            "next_date": next_date
        })

    def op_is_within(self):
        if self.is_need_filter_term() and not self.filter_term and self.filter_term != 0:
            return ''
        start_date, end_date = self.get_date(self.filter_term_modifier, self.filter_term)
        if not (start_date, end_date ):
            return ""
        return "`%(column_name)s` >= '%(start_date)s' and `%(column_name)s` <= '%(end_date)s'" % ({
            "column_name": self.column_name,
            "start_date": self._format_date(start_date),
            "end_date": self._format_date(end_date)
        })

    def op_is_before(self):
        if self.is_need_filter_term() and not self.filter_term and self.filter_term != 0:
            return ''
        target_date, _ = self.get_date(self.filter_term_modifier, self.filter_term)
        if not target_date:
            return ""
        return "`%(column_name)s` < '%(target_date)s' and `%(column_name)s` is not null" % ({
            "column_name": self.column_name,
            "target_date": self._format_date(target_date)
        })

    def op_is_after(self):
        if self.is_need_filter_term() and not self.filter_term and self.filter_term != 0:
            return ''
        target_date, _ = self.get_date(self.filter_term_modifier, self.filter_term)
        if not target_date:
            return ""
        next_date = self._format_date(target_date + timedelta(days=1))
        return "`%(column_name)s` >= '%(target_date)s' and `%(column_name)s` is not null" % ({
            "column_name": self.column_name,
            "target_date": next_date,
        })

    def op_is_on_or_before(self):
        if self.is_need_filter_term() and not self.filter_term and self.filter_term != 0:
            return ''
        target_date, _ = self.get_date(self.filter_term_modifier, self.filter_term)
        if not target_date:
            return ""
        return "`%(column_name)s` <= '%(target_date)s' and `%(column_name)s` is not null" % ({
            "column_name": self.column_name,
            "target_date": self._format_date(target_date)
        })

    def op_is_on_or_after(self):
        if self.is_need_filter_term() and not self.filter_term and self.filter_term != 0:
            return ''
        target_date, _ = self.get_date(self.filter_term_modifier, self.filter_term)
        if not target_date:
            return ""
        return "`%(column_name)s` >= '%(target_date)s' and `%(column_name)s` is not null" % ({
            "column_name": self.column_name,
            "target_date": self._format_date(target_date)
        })

    def op_is_not(self):
        if self.is_need_filter_term() and not self.filter_term and self.filter_term != 0:
            return ''
        target_date, _ = self.get_date(self.filter_term_modifier, self.filter_term)
        if not target_date:
            return ""
        start_date = target_date - timedelta(days=1)
        end_date = target_date + timedelta(days=1)
        return "(`%(column_name)s` >= '%(end_date)s' or `%(column_name)s` <= '%(start_date)s' or `%(column_name)s` is null)" % (
        {
            "column_name": self.column_name,
            "start_date": self._format_date(start_date),
            "end_date": self._format_date(end_date)
        })



class TextOperator(Operator):
    SUPPORT_FILTER_PREDICATE = [
        FilterPredicateTypes.CONTAINS,
        FilterPredicateTypes.NOT_CONTAIN,
        FilterPredicateTypes.IS,
        FilterPredicateTypes.IS_NOT,
        FilterPredicateTypes.EMPTY,
        FilterPredicateTypes.NOT_EMPTY,
        FilterPredicateTypes.IS_CURRENT_USER_ID,
    ]

    def __init__(self, column, filter_item):
        super(TextOperator, self).__init__(column, filter_item)

    
class ViewFilter(object):

    def format_filter_predicate(self, username, q, filter_conjunction, filter_obj, condition):
        value = filter_obj['filter_term']
        filter_predicate = filter_obj['filter_predicate']
        current_filter = Q()

        try:
            if filter_predicate == FilterPredicateTypes.HAS_ALL_OF or \
                    filter_predicate == FilterPredicateTypes.HAS_ANY_OF or \
                    filter_predicate == FilterPredicateTypes.IS_ANY_OF:
                current_filter = Q(**{f'{condition}__in': value})

            elif filter_predicate == FilterPredicateTypes.HAS_NONE_OF or \
                    filter_predicate == FilterPredicateTypes.IS_NONE_OF:
                current_filter = ~Q(**{f'{condition}__in': value})

            elif filter_predicate == FilterPredicateTypes.IS_EXACTLY or \
                    filter_predicate == FilterPredicateTypes.IS or \
                    filter_predicate == FilterPredicateTypes.EQUAL or \
                    filter_predicate == FilterPredicateTypes.IS_WITHIN:
                current_filter = Q(**{condition: value})

            elif filter_predicate == FilterPredicateTypes.IS_NOT or \
                    filter_predicate == FilterPredicateTypes.NOT_EQUAL:
                current_filter = ~Q(**{condition: value})

            elif filter_predicate == FilterPredicateTypes.CONTAINS:
                current_filter = Q(**{f'{condition}__icontains': value})

            elif filter_predicate == FilterPredicateTypes.NOT_CONTAIN:
                current_filter = ~Q(**{f'{condition}__icontains': value})

            elif filter_predicate == FilterPredicateTypes.LESS or \
                    filter_predicate == FilterPredicateTypes.IS_BEFORE:
                current_filter = Q(**{f'{condition}__lt': value})

            elif filter_predicate == FilterPredicateTypes.GREATER or \
                    filter_predicate == FilterPredicateTypes.IS_AFTER:
                current_filter = Q(**{f'{condition}__gt': value})

            elif filter_predicate == FilterPredicateTypes.LESS_OR_EQUAL or \
                    filter_predicate == FilterPredicateTypes.IS_ON_OR_BEFORE:
                current_filter = Q(**{f'{condition}__lte': value})

            elif filter_predicate == FilterPredicateTypes.GREATER_OR_EQUAL or \
                    filter_predicate == FilterPredicateTypes.IS_ON_OR_AFTER:
                current_filter = Q(**{f'{condition}__gte': value})

            elif filter_predicate == FilterPredicateTypes.EMPTY:
                if filter_obj.get('empty_only_null', False):
                    current_filter = Q(
                        **{f'{condition}__isnull': True})
                elif filter_obj.get('empty_only_zero', False):
                    current_filter = Q(
                        **{f'{condition}': 0})                        
                else:
                    current_filter = Q(
                        **{f'{condition}__isnull': True}) | Q(**{condition: ''})

            elif filter_predicate == FilterPredicateTypes.NOT_EMPTY:
                if filter_obj.get('empty_only_null', False):
                    current_filter = Q(
                        **{f'{condition}__isnull': False})
                elif filter_obj.get('empty_only_zero', False):
                    current_filter = ~Q(
                        **{f'{condition}': 0})
                else:
                    current_filter = Q(
                        **{f'{condition}__isnull': False}) & ~Q(**{condition: ''})

            elif filter_predicate == FilterPredicateTypes.INCLUDE_ME or \
                    filter_predicate == FilterPredicateTypes.IS_CURRENT_USER_ID:
                current_filter = Q(**{f'{condition}__in': [username]})

            else:
                current_filter = Q(**{condition: value})
        except Exception as e:
            logger.error(e)

        if filter_conjunction.lower() == 'or':
            q = q | current_filter
        else:
            q = q & current_filter

        return q

    def filter_tickets_by_view(self, username, view):
        from seahub.project.models import TicketTags, TicketParticipants, TicketAssignees

        basic_filters = view.get('basic_filters', [])
        filters = view.get('filters', [])
        filter_conjunction = view.get('filter_conjunction', 'OR')
        sorts = view.get('sorts', [])
        basic_q = Q()
        q = Q()

        for filter_obj in basic_filters:
            try:
                basic_filter_conjunction = 'and'
                column_key = filter_obj.get('column_key')
                value = filter_obj['filter_term']
                filter_predicate = filter_obj['filter_predicate']
                condition = column_key
                if column_key == 'status' or column_key == 'type':
                    if value == []:
                        continue
                    basic_q = self.format_filter_predicate(
                        username, basic_q, basic_filter_conjunction, filter_obj, condition)
                elif column_key == 'tags':
                    if value == []:
                        continue
                    tags = TicketTags.objects.filter(tag_id__in=value)
                    if tags:
                        ticket_ids = [tag.ticket_id for tag in tags]
                        condition = 'id'
                        filter_obj['filter_term'] = ticket_ids
                        basic_q = self.format_filter_predicate(
                            username, basic_q, basic_filter_conjunction, filter_obj, condition)
            except Exception as e:
                logger.error(e)

        for filter_obj in filters:
            try:
                column_key = filter_obj.get('column_key')
                value = filter_obj['filter_term']
                filter_predicate = filter_obj['filter_predicate']
                condition = column_key
                if column_key == 'type':
                    if value == '':
                        value = None
                    elif isinstance(value, list):
                        try:
                            value = [int(v) for v in value]
                        except ValueError:
                            pass
                    else:
                        try:
                            value = int(value)
                        except ValueError:
                            pass
                    filter_obj['filter_term'] = value
                    filter_obj['empty_only_null'] = True
                    q = self.format_filter_predicate(
                        username, q, filter_conjunction, filter_obj, condition)

                elif column_key == 'assignees':
                    if value == '':
                        value = None
                    assignees = TicketAssignees.objects.filter(
                        assignee__in=value)
                    ticket_ids = [assignee.ticket_id for assignee in assignees]
                    condition = 'id'
                    filter_obj['filter_term'] = ticket_ids
                    if filter_predicate == FilterPredicateTypes.IS_EXACTLY:
                        filter_obj['filter_predicate'] = FilterPredicateTypes.HAS_ANY_OF
                    q = self.format_filter_predicate(
                        username, q, filter_conjunction, filter_obj, condition)

                elif column_key == 'participants':
                    if value == '':
                        value = None
                    participants = TicketParticipants.objects.filter(
                        participant__in=value)
                    ticket_ids = [
                        participant.ticket_id for participant in participants]
                    condition = 'id'
                    filter_obj['filter_term'] = ticket_ids
                    if filter_predicate == FilterPredicateTypes.IS_EXACTLY:
                        filter_obj['filter_predicate'] = FilterPredicateTypes.HAS_ANY_OF
                    q = self.format_filter_predicate(
                        username, q, filter_conjunction, filter_obj, condition)

                elif column_key == 'priority':
                    if value == '':
                        value = 0
                    try:
                        filter_obj['filter_term'] = int(value)
                    except ValueError:
                        pass
                    filter_obj['empty_only_zero'] = True
                    q = self.format_filter_predicate(
                        username, q, filter_conjunction, filter_obj, condition)

                elif column_key == 'creator':
                    if filter_predicate == FilterPredicateTypes.CONTAINS:
                        filter_obj['filter_predicate'] = FilterPredicateTypes.HAS_ANY_OF
                    elif filter_predicate == FilterPredicateTypes.NOT_CONTAIN:
                        filter_obj['filter_predicate'] = FilterPredicateTypes.HAS_NONE_OF
                    elif filter_predicate == FilterPredicateTypes.IS:
                        filter_obj['filter_predicate'] = FilterPredicateTypes.HAS_ANY_OF
                    elif filter_predicate == FilterPredicateTypes.IS_NOT:
                        filter_obj['filter_predicate'] = FilterPredicateTypes.HAS_NONE_OF
                    q = self.format_filter_predicate(
                        username, q, filter_conjunction, filter_obj, condition)

                elif column_key == 'created_at':
                    filter_term_modifier = filter_obj['filter_term_modifier']
                    start_date, end_date = DateOperator().get_date(filter_term_modifier, value)
                    filter_obj['filter_term'] = start_date
                    date_period_filter_conjunction = filter_conjunction

                    if filter_predicate == FilterPredicateTypes.IS:
                        end_date = start_date + timedelta(days=1)
                        date_period_filter_conjunction = 'and'
                    elif filter_predicate == FilterPredicateTypes.IS_NOT:
                        end_date = start_date + timedelta(days=1)
                        start_date, end_date = end_date, start_date
                        filter_obj['filter_term'] = start_date
                        date_period_filter_conjunction = 'or'
                    if filter_predicate == FilterPredicateTypes.IS_WITHIN:
                        date_period_filter_conjunction = 'and'

                    if end_date is not None:
                        date_q = Q()
                        filter_obj['filter_predicate'] = FilterPredicateTypes.GREATER_OR_EQUAL
                        date_q = self.format_filter_predicate(
                            username, date_q, date_period_filter_conjunction, filter_obj, condition)
                        filter_obj['filter_predicate'] = FilterPredicateTypes.LESS_OR_EQUAL
                        filter_obj['filter_term'] = end_date
                        date_q = self.format_filter_predicate(
                            username, date_q, date_period_filter_conjunction, filter_obj, condition)
                        if filter_conjunction.lower() == 'or':
                            q = q | date_q
                        else:
                            q = q & date_q
                    else:
                        q = self.format_filter_predicate(
                            username, q, filter_conjunction, filter_obj, condition)

                elif column_key == 'title':
                    q = self.format_filter_predicate(
                        username, q, filter_conjunction, filter_obj, condition)

                elif column_key == 'content':
                    q = self.format_filter_predicate(
                        username, q, filter_conjunction, filter_obj, condition)

            except Exception as e:
                logger.error(e)

        q = basic_q & q
        sorts = [
            f'-{sort["column_key"]}' if sort['sort_type'] == 'down' else sort['column_key'] for sort in sorts if sort.get('column_key')]
        if not sorts:
            sorts = ['-number']

        return q, sorts

def filter_tickets_by_view(username, view):
    q, sorts = ViewFilter().filter_tickets_by_view(username, view)
    return q, sorts


def _filter2sql(operator):
    support_filter_predicates = operator.SUPPORT_FILTER_PREDICATE
    filter_predicate = operator.filter_predicate
    # no predicate, ignore
    if not filter_predicate:
        return ''
    # only operator need modifier, date and no filter_term_modifier, ignore
    if isinstance(operator, DateOperator) and not operator.filter_term_modifier:
        return ''
    if operator.filter_predicate not in support_filter_predicates:
        raise ColumnFilterInvalidError(
            operator.column_name,
            operator.column_type,
            operator.filter_predicate,
            support_filter_predicates,
            "Filter on %(column_name)s invalid: %(column_type)s type column '%(column_name)s' does not support '%(value)s', available predicates are %(available_predicates)s" % {
                'column_type': operator.column_type,
                'column_name': operator.column_name,
                'value': operator.filter_predicate,
                'available_predicates': support_filter_predicates,
            }
        )

    if filter_predicate == FilterPredicateTypes.IS:
        return operator.op_is()
    if filter_predicate == FilterPredicateTypes.IS_NOT:
        return operator.op_is_not()
    if filter_predicate == FilterPredicateTypes.CONTAINS:
        return operator.op_contains()
    if filter_predicate == FilterPredicateTypes.NOT_CONTAIN:
        return operator.op_does_not_contain()
    if filter_predicate == FilterPredicateTypes.EMPTY:
        return operator.op_is_empty()
    if filter_predicate == FilterPredicateTypes.NOT_EMPTY:
        return operator.op_is_not_empty()
    if filter_predicate == FilterPredicateTypes.EQUAL:
        return operator.op_equal()
    if filter_predicate == FilterPredicateTypes.NOT_EQUAL:
        return operator.op_not_equal()
    if filter_predicate == FilterPredicateTypes.GREATER:
        return operator.op_greater()
    if filter_predicate == FilterPredicateTypes.GREATER_OR_EQUAL:
        return operator.op_greater_or_equal()
    if filter_predicate == FilterPredicateTypes.LESS:
        return operator.op_less()
    if filter_predicate == FilterPredicateTypes.LESS_OR_EQUAL:
        return operator.op_less_or_equal()
    if filter_predicate == FilterPredicateTypes.IS_ON_OR_AFTER:
        return operator.op_is_on_or_after()
    if filter_predicate == FilterPredicateTypes.IS_AFTER:
        return operator.op_is_after()
    if filter_predicate == FilterPredicateTypes.IS_ON_OR_BEFORE:
        return operator.op_is_on_or_before()
    if filter_predicate == FilterPredicateTypes.IS_BEFORE:
        return operator.op_is_before()
    if filter_predicate == FilterPredicateTypes.IS_WITHIN:
        return operator.op_is_within()
    if filter_predicate == FilterPredicateTypes.IS_CURRENT_USER_ID:
        return operator.op_is_current_user_id()
    return ''



def _get_operator_by_type(column_type):
    if column_type in [
        PropertyTypes.TEXT,
    ]:
        return TextOperator

    if column_type in [
        PropertyTypes.DATETIME,
    ]:
        return DateOperator

    return None

class SQLGenerator(object):

    def __init__(self, table_name, columns, hidden_columns, view, start=0, limit=0, username=''):
        self.table_name = table_name
        self.view = view
        self.columns = columns
        self.hidden_columns = hidden_columns
        self.start = start
        self.limit = limit
        self.username = username

    def _get_column_by_key(self, col_key):
        for col in self.columns:
            if col.get('key') == col_key or col.get('name') == col_key:
                return col
        return None

    def _get_column_by_name(self, col_name):
        for col in self.columns:
            if col.get('name') == col_name:
                return col
        return None

    def sort_2_sql(self):
        condition_sorts = self.view.get('sorts', [])
        order_header = 'ORDER BY '
        clauses = []
        if condition_sorts:
            for sort in condition_sorts:
                column_key = sort.get('column_key', '')
                column_name = sort.get('column_name', '')
                sort_type = 'ASC' if sort.get('sort_type', 'DESC') == 'up' else 'DESC'
                column = self._get_column_by_key(column_key)
                if not column:
                    column = self._get_column_by_name(column_name)
                    if not column:
                        if column_key in ['_ctime', '_mtime']:
                            order_condition = '%s %s' % (column_key, sort_type)
                            clauses.append(order_condition)
                            continue
                        else:
                            continue

                order_condition = '`%s` %s' % (column.get('name'), sort_type)
                clauses.append(order_condition)
        if not clauses:
            return []
        return "%s%s" % (
            order_header,
            ', '.join(clauses)
        )

    def _get_column_type(self, column):
        column_type = column.get('type', '')

        return column_type

    def _generator_filters_sql(self, filters, filter_conjunction = 'And'):
        if not filters:
            return ''

        filter_string_list = []
        filter_conjunction_split = " %s " % filter_conjunction
        for filter_item in filters:
            column_key = filter_item.get('column_key')
            column_name = filter_item.get('column_name')
            # skip when the column key or name is missing
            if not (column_key or column_name):
                continue
            column = column_key and self._get_column_by_key(column_key)
            if not column:
                column = column_name and self._get_column_by_name(column_name)
            # skip when the column is deleted
            if not column:
                logger.warning('Column not found column_key: %s column_name: %s' % (column_key, column_name))
                continue

            if filter_item.get('filter_predicate') == 'include_me':
                filter_item['filter_term'] = [self.username]
            if filter_item.get('filter_predicate') == 'is_current_user_ID':
                pass

            column_type = self._get_column_type(column)
            column['type'] = column_type
            operator_cls = _get_operator_by_type(column_type)
            if not operator_cls:
                raise ValueError('filter: %s not support to sql' % filter_item)
            else:
                operator = operator_cls(column, filter_item)
            sql_condition = _filter2sql(operator)
            if not sql_condition:
                continue
            filter_string_list.append(sql_condition)

        if filter_string_list:
            return "%s" % (
                filter_conjunction_split.join(filter_string_list)
            )
        return ''

    def _basic_filters_sql(self):
        basic_filters = self.view.get('basic_filters', [])
        filter_conjunction = 'AND'
        if not basic_filters:
            return ''

        filters = []
        for filter_item in basic_filters:
            pass

        return self._generator_filters_sql(filters, filter_conjunction)

    def _filters_sql(self):
        filters = self.view.get('filters', [])
        filter_conjunction = self.view.get('filter_conjunction', 'And')
        return self._generator_filters_sql(filters, filter_conjunction)

    def _filter_2_sql(self):
        filter_header = 'WHERE'
        basic_filters_sql = self._basic_filters_sql()
        filters_sql = self._filters_sql()

        if not basic_filters_sql and not filters_sql:
            return ''

        if basic_filters_sql and filters_sql:
            return "%s (%s) AND (%s)" % (
                filter_header,
                basic_filters_sql,
                filters_sql,
            )

        if basic_filters_sql and not filters_sql:
            return "%s %s" % (
                filter_header,
                basic_filters_sql,
            )

        return "%s %s" % (
                filter_header,
                filters_sql,
            )

    def _limit_2_sql(self):
        return '%s %s, %s' % (
            "LIMIT",
            self.start or 0,
            self.limit or 100
        )

    def to_sql(self):
        column_names = [column['name'] for column in self.columns]
        sql_columns = [column_name for column_name in column_names if column_name not in self.hidden_columns]
        column_join = ', '.join(['`%s`' % column_name for column_name in sql_columns])
        sql = "SELECT %s FROM `%s`" % (column_join, self.table_name)
        filter_clause = self._filter_2_sql()
        sort_clause = self.sort_2_sql()
        limit_clause = self._limit_2_sql()
        if filter_clause:
            sql = "%s %s" % (sql, filter_clause)
        if sort_clause:
            sql = "%s %s" % (sql, sort_clause)
        if limit_clause:
            sql = "%s %s" % (sql, limit_clause)
        return sql


def view_data_2_sql(table, columns, hidden_columns, view, start, limit, params):
    """ view to sql """
    sql_generator = SQLGenerator(table, columns, hidden_columns, view, start, limit, params)
    return sql_generator.to_sql()
