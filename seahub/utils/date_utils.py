import datetime

DATE_ONLY_FORMAT = 'YYYY-MM-DD'


def normalize_date(value):
    """Return the calendar date represented by a date or datetime value."""
    if value in (None, ''):
        return value

    if isinstance(value, datetime.datetime):
        return value.date().isoformat()

    if isinstance(value, datetime.date):
        return value.isoformat()

    value_str = str(value)
    try:
        date_value = datetime.date.fromisoformat(value_str)
    except ValueError:
        datetime_value = f'{value_str[:-1]}+00:00' if value_str.endswith('Z') else value_str
        try:
            due_datetime = datetime.datetime.fromisoformat(datetime_value)
        except ValueError as error:
            raise ValueError('due_date invalid.') from error
        return due_datetime.date().isoformat()

    if date_value.isoformat() != value_str:
        raise ValueError('due_date invalid.')
    return value_str


def normalize_query_date_fields(result):
    """Normalize SeaDB columns declared as calendar dates in their metadata."""
    if not result:
        return result

    field_names = set()
    for column in result.get('metadata') or []:
        column_data = column.get('data') or {}
        if column_data.get('format') != DATE_ONLY_FORMAT:
            continue
        field_names.update(
            field_name for field_name in (column.get('name'), column.get('key'))
            if field_name
        )

    if not field_names:
        return result

    for record in result.get('results') or []:
        for field_name in field_names:
            if field_name in record:
                record[field_name] = normalize_date(record[field_name])
    return result
