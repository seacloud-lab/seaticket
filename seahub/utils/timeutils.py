# Copyright (c) 2012-2016 Seafile Ltd.
import logging
import pytz
import datetime
import six
import calendar
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
from django.utils.timezone import get_current_timezone

logger = logging.getLogger(__name__)

# https://docs.djangoproject.com/en/1.11/ref/utils/#django.utils.timezone.get_current_timezone
current_timezone = get_current_timezone()

def dt(value):
    """Convert 32/64 bits timestamp to datetime object.
    """
    try:
        return datetime.datetime.utcfromtimestamp(value)
    except ValueError:
        # TODO: need a better way to handle 64 bits timestamp.
        return datetime.datetime.utcfromtimestamp(value/1000000)

def value_to_db_datetime(value):
    if value is None:
        return None

    # MySQL doesn't support tz-aware datetimes
    if timezone.is_aware(value):
        if settings.USE_TZ:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            raise ValueError("MySQL backend does not support timezone-aware datetimes when USE_TZ is False.")

    # MySQL doesn't support microseconds
    return six.text_type(value.replace(microsecond=0))

def utc_to_local(dt):
    # change from UTC timezone to current seahub timezone
    tz = timezone.get_default_timezone()
    utc = dt.replace(tzinfo=timezone.utc)
    local = timezone.make_naive(utc, tz)
    return local

def timestamp_to_isoformat_timestr(timestamp, divided_by=1000000):
    try:
        min_ts = -(1 << 31)
        max_ts = (1 << 31) - 1
        if min_ts <= timestamp <= max_ts:
            dt_obj = datetime.datetime.fromtimestamp(timestamp)
        else:
            dt_obj = datetime.datetime.fromtimestamp(timestamp/divided_by)

        dt_obj = dt_obj.replace(microsecond=0)
        aware_datetime = dt_obj.replace(tzinfo=current_timezone)
        target_timezone = pytz.timezone(str(current_timezone))
        localized_datetime = target_timezone.normalize(aware_datetime.astimezone(pytz.UTC))
        isoformat_timestr = localized_datetime.isoformat()
        return isoformat_timestr
    except Exception as e:
        logger.error(e)
        return ''

# https://pypi.org/project/pytz/
def datetime_to_isoformat_timestr(datetime):
    if not datetime:
        return ''
    try:
        # This library only supports two ways of building a localized time.
        # The first is to use the localize() method provided by the pytz library.
        # This is used to localize a naive datetime (datetime with no timezone information):
        datetime = datetime.replace(microsecond=0)
        aware_datetime = datetime.replace(tzinfo=current_timezone)
        target_timezone = pytz.timezone(str(current_timezone))
        localized_datetime = target_timezone.normalize(aware_datetime.astimezone(pytz.UTC))
        isoformat_timestr = localized_datetime.isoformat()
        return isoformat_timestr
    except Exception as e:
        logger.error(e)
        return ''

def utc_datetime_to_isoformat_timestr(utc_datetime):
    if not utc_datetime:
        return ''
    try:
        # The second way of building a localized time is by converting an existing
        # localized time using the standard astimezone() method:
        utc_datetime = utc_datetime.replace(microsecond=0)
        utc_datetime = pytz.utc.localize(utc_datetime)
        isoformat_timestr = utc_datetime.astimezone(current_timezone).isoformat()
        return isoformat_timestr
    except Exception as e:
        logger.error(e)
        return ''

def datetime_to_timestamp(datetime_obj):
    epoch = datetime.datetime(1970, 1, 1)
    local = utc_to_local(datetime_obj)
    time_diff = local - epoch
    return time_diff.seconds + (time_diff.days * 24 * 3600)


def lines_monthly(month_num):
    """
    Return a list formated as year-month in recent "month_num" month.
    This is used for handle the asset file path which contains params such as
    "files/2020-08, files/2019-08, ...."
    Example for today of 2021-08-15:
    lines_monthly(6)

    ['2021-08', '2021-07', '2021-06', '2021-05', '2021-04', '2021-03']
    """
    today = datetime.datetime.today()
    lines = []

    for i in range(month_num):
        year_num, month_num = divmod(i, 12)
        m = today.month - month_num
        y = m <= 0 and (today.year - year_num - 1) or (today.year - year_num)
        m = m <= 0 and m + 12 or m
        ym = "%s-%02d" % (y, m)
        lines.append(ym)
    return lines

def get_month_date_range(year=None, month=None):
    if year is None or month is None:
        today = datetime.date.today()
        year, month = today.year, today.month
    
    cache_key = f'month_range_{year}_{month}'
    date_range = cache.get(cache_key)
    
    if date_range is None:
        first_day = datetime.date(year, month, 1)
        last_day = datetime.date(year, month, 
                               calendar.monthrange(year, month)[1])
        date_range = (first_day, last_day)
        days_in_month = calendar.monthrange(year, month)[1]
        cache_timeout = 60 * 60 * 24 * days_in_month # cache time out
        cache.set(cache_key, date_range, cache_timeout)
    
    return date_range
