const gettext = window.gettext;

const FILTER_PREDICATE_SHOW = {
  'contains': gettext('contains'),
  'does_not_contain': gettext('does not contain'),
  'is': gettext('is'),
  'is_not': gettext('is not'),
  'equal': gettext('equal'),
  'not_equal': gettext('not equal'),
  'less': gettext('less'),
  'greater': gettext('greater'),
  'less_or_equal': gettext('less or equal'),
  'greater_or_equal': gettext('greater or equal'),
  'is_empty': gettext('is empty'),
  'is_not_empty': gettext('is not empty'),
  'is_within': gettext('is within'),
  'is_before': gettext('is before'),
  'is_after': gettext('is after'),
  'is_on_or_before': gettext('is on or before'),
  'is_on_or_after': gettext('is on or after'),
  'has_any_of': gettext('has any of'),
  'has_all_of': gettext('has all of'),
  'has_none_of': gettext('has none of'),
  'is_exactly': gettext('is exactly'),
  'is_any_of': gettext('is any of'),
  'is_none_of': gettext('is none of'),
  'include_me': gettext('include me')
};

const FILTER_TERM_MODIFIER_SHOW = {
  'today': gettext('today'),
  'tomorrow': gettext('tomorrow'),
  'yesterday': gettext('yesterday'),
  'one_week_ago': gettext('one week ago'),
  'one_week_from_now': gettext('one week from now'),
  'one_month_ago': gettext('one month ago'),
  'one_month_from_now': gettext('one month from now'),
  'number_of_days_ago': gettext('number of days ago'),
  'number_of_days_from_now': gettext('number of days from now'),
  'exact_date': gettext('exact date'),
  'the_past_week': gettext('last week'),
  'the_past_month': gettext('last month'),
  'the_past_year': gettext('last year'),
  'the_next_week': gettext('the next week'),
  'the_next_month': gettext('the next month'),
  'the_next_year': gettext('the next year'),
  'the_next_numbers_of_days': gettext('the next numbers of days'),
  'the_past_numbers_of_days': gettext('the past numbers of days'),
  'this_week': gettext('this week'),
  'this_month': gettext('this month'),
  'this_year': gettext('this year')
};

export { FILTER_PREDICATE_SHOW, FILTER_TERM_MODIFIER_SHOW };
