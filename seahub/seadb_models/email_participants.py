import logging
from email.utils import parseaddr

from seahub.seadb_models.models import SchemaTables

logger = logging.getLogger(__name__)

EMAIL_PARTICIPANT_THREAD_BATCH_SIZE = 1000
# SeaDB caps each SELECT at 10,000 rows, even when a larger LIMIT is requested.
EMAIL_PARTICIPANTS_PAGE_SIZE = 10000


def _normalize_email_address(email_address):
    local_part, separator, domain = email_address.rpartition('@')
    if not separator or not local_part or not domain:
        return email_address
    return f'{local_part}@{domain.lower()}'


def get_email_participants_by_thread_ids(
    seadb_api,
    project_uuid,
    connection_id,
    thread_ids,
):
    from seahub.project.utils import extract_email_addresses_to_display

    unique_thread_ids = list(dict.fromkeys(int(thread_id) for thread_id in thread_ids))
    participants_by_thread = {}
    email_table_name = SchemaTables.EMAIL.table_name(connection_id)

    for batch_start in range(0, len(unique_thread_ids), EMAIL_PARTICIPANT_THREAD_BATCH_SIZE):
        batch_thread_ids = unique_thread_ids[
            batch_start:batch_start + EMAIL_PARTICIPANT_THREAD_BATCH_SIZE
        ]
        thread_ids_sql = ', '.join(str(thread_id) for thread_id in batch_thread_ids)

        sender_order_by_thread = {thread_id: {} for thread_id in batch_thread_ids}
        sender_info_by_thread = {thread_id: {} for thread_id in batch_thread_ids}
        query_succeeded = False
        email_offset = 0

        while True:
            emails_sql = (
                f"SELECT `thread_id`, `email_from`, `modified_time` "
                f"FROM `{email_table_name}` "
                f"WHERE `thread_id` IN ({thread_ids_sql}) AND deleted = false "
                f"ORDER BY `modified_time`, `_pk` "
                f"LIMIT {email_offset}, {EMAIL_PARTICIPANTS_PAGE_SIZE}"
            )

            try:
                result = seadb_api.query_rows(project_uuid, emails_sql, convert_keys=True)
                emails = result.get('results', [])
            except Exception as e:
                logger.error(
                    f'SeaDB query error for email participants {email_table_name}: {e}'
                )
                break

            for email in emails:
                try:
                    thread_id = int(email['thread_id'])
                except (KeyError, TypeError, ValueError):
                    continue

                if thread_id not in sender_order_by_thread:
                    continue

                email_from = email.get('email_from')
                if not email_from:
                    continue

                for address_info in extract_email_addresses_to_display(email_from):
                    email_name, email_address = parseaddr(address_info)
                    if not email_address:
                        continue

                    participant_key = _normalize_email_address(email_address)
                    sender_info = sender_info_by_thread[thread_id]

                    if email_name or not sender_info.get(participant_key):
                        sender_info[participant_key] = address_info

                    sender_order_by_thread[thread_id].setdefault(participant_key, None)

            if len(emails) < EMAIL_PARTICIPANTS_PAGE_SIZE:
                query_succeeded = True
                break

            email_offset += len(emails)

        if not query_succeeded:
            continue

        for thread_id in batch_thread_ids:
            sender_order = sender_order_by_thread[thread_id]
            sender_info = sender_info_by_thread[thread_id]
            participants_by_thread[thread_id] = [
                sender_info[email_address]
                for email_address in sender_order
                if email_address in sender_info
            ]

    return participants_by_thread


def add_email_participants(
    seadb_api,
    project_uuid,
    connection_id,
    records,
    columns,
):
    records_by_thread = {}

    for record in records:
        record['participants'] = None
        try:
            thread_id = int(record['_pk'])
        except (KeyError, TypeError, ValueError):
            continue

        records_by_thread.setdefault(thread_id, []).append(record)

    participants_by_thread = get_email_participants_by_thread_ids(
        seadb_api,
        project_uuid,
        connection_id,
        list(records_by_thread),
    )

    for thread_id, thread_records in records_by_thread.items():
        if thread_id not in participants_by_thread:
            continue

        for record in thread_records:
            record['participants'] = participants_by_thread[thread_id]

    if not any(column.get('key') == 'participants' for column in columns):
        columns.append({
            'key': 'participants',
            'name': 'participants',
            'type': 'list',
        })

    return records, columns
