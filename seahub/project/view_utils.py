import logging
from datetime import datetime, timezone, timedelta

from django.db.models import Q

from seahub.project.constants import FilterPredicateTypes, FilterTermModifier


logger = logging.getLogger(__name__)


class DateOperator(object):
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

    def is_need_filter_term(self, filter_term_modifier):
        if filter_term_modifier in [
            FilterTermModifier.NUMBER_OF_DAYS_AGO,
            FilterTermModifier.NUMBER_OF_DAYS_FROM_NOW,
            FilterTermModifier.THE_NEXT_NUMBERS_OF_DAYS,
            FilterTermModifier.THE_PAST_NUMBERS_OF_DAYS,
            FilterTermModifier.EXACT_DATE
        ]:
            return True
        return False


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
