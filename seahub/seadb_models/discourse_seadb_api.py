import logging
import datetime

from seahub.project.seadb_api import SeaDBAPI
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE, ATTACHMENT_ISSUE_MAX_COMMENTS
from seahub.project.constants import ConnectionType
from seahub.seadb_models.models import SchemaTables

logger = logging.getLogger(__name__)

_MORE_REPLIES_OMITTED_NOTICE = '[more replies omitted due to content limit]'


def _truncate_content_with_ellipsis(content, max_length):
    content = content or ''
    if max_length <= 0:
        return ''
    if len(content) <= max_length:
        return content
    if max_length <= 3:
        return '.' * max_length
    return content[:max_length - 3] + '...'


def _build_reply_notice(content):
    return {
        'author': None,
        'content': content,
        'post_number': None,
        'modified_time': None,
    }

class DiscourseSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_topics_by_connection_id(self, connection_id, start, limit):
        """Retrieve all topics for the specified connection_id."""
        table_name = SchemaTables.DISCOURSE_TOPICS.table_name(connection_id)
        sql = f"SELECT `_pk`, `topic_id`, `title`, `slug`, `modified_time`, `created_time`, `resolved`, `linked_ticket` FROM `{table_name}` WHERE (`deleted` = False OR `deleted` IS NULL) LIMIT {limit} OFFSET {start}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_topic_by_pk(self, connection_id, _pk):
        table_name = SchemaTables.DISCOURSE_TOPICS.table_name(connection_id)
        sql = f"SELECT `_pk`, `title`, `topic_id`, `slug`, `linked_ticket` FROM `{table_name}` WHERE `_pk` = {_pk} AND (`deleted` = False OR `deleted` IS NULL)"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response and response['results']:
            return response['results'][0]
        return {}

    def get_replies_by_topic_id(self, connection_id, topic_id):
        """Retrieve all replies for the specified topic_id."""
        table_name = SchemaTables.DISCOURSE_REPLIES.table_name(connection_id)
        sql = f"SELECT `topic_id`, `post_number`, `content`, `author`, `modified_time`, `accepted_answer` FROM `{table_name}` WHERE `topic_id` = {topic_id}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_topics_by_pks(self, connection_id, _pks):
        _pks_str = ', '.join([
            str(_pk)
            for _pk in _pks
        ])
        table_name = SchemaTables.DISCOURSE_TOPICS.table_name(connection_id)
        sql = f"SELECT `_pk`, `topic_id`, `title`, `slug`, `created_time` FROM `{table_name}` WHERE `_pk` in ({_pks_str}) AND (`deleted` = False OR `deleted` IS NULL)"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])

    def get_replies_by_topic_ids(self, connection_id, topic_ids):
        if not topic_ids:
            return {}

        table_name = SchemaTables.DISCOURSE_REPLIES.table_name(connection_id)
        topic_ids_str = ', '.join(str(topic_id) for topic_id in topic_ids)
        sql = f"SELECT `topic_id`, `post_number`, `content`, `author`, `modified_time`, `accepted_answer` FROM `{table_name}` WHERE `topic_id` in ({topic_ids_str}) ORDER BY `topic_id` ASC, `post_number` ASC"
        replies = self.seadb_api.query_rows(self.base_id, sql).get('results', [])
        result = {}
        for reply in replies:
            topic_id = reply['topic_id']
            if topic_id not in result:
                result[topic_id] = [reply]
            else:
                result[topic_id].append(reply)
        return result

    def _get_selected_topic_replies_for_attachment(self, topic_replies, limit_for_each_id):
        if not topic_replies:
            return []

        first_reply = topic_replies[0]
        first_content = first_reply.get('content', '') or ''
        if len(first_content) > ATTACHMENT_CONTENT_MAX_SIZE:
            selected_replies = []
            truncated_content = _truncate_content_with_ellipsis(first_content, ATTACHMENT_CONTENT_MAX_SIZE)
            if truncated_content:
                selected_replies.append({
                    **first_reply,
                    'content': truncated_content,
                })
            selected_replies.append(_build_reply_notice(_MORE_REPLIES_OMITTED_NOTICE))
            return selected_replies

        latest_replies = topic_replies[-limit_for_each_id:] if limit_for_each_id > 0 else []
        replies_by_post_number = {
            reply['post_number']: reply
            for reply in latest_replies
        }
        replies_by_post_number[first_reply['post_number']] = first_reply
        replies = [replies_by_post_number[post_number] for post_number in sorted(replies_by_post_number)]

        selected_replies = []
        total_content_size = 0
        for reply in replies:
            content = reply.get('content', '') or ''
            remaining_size = ATTACHMENT_CONTENT_MAX_SIZE - total_content_size
            if remaining_size <= 0:
                break

            if len(content) > remaining_size:
                truncated_content = _truncate_content_with_ellipsis(content, remaining_size)
                if truncated_content:
                    selected_replies.append({
                        **reply,
                        'content': truncated_content,
                    })
                selected_replies.append(_build_reply_notice(_MORE_REPLIES_OMITTED_NOTICE))
                break

            selected_replies.append(reply)
            total_content_size += len(content)

        return selected_replies

    def get_whole_discourse_data(self, connection_ids_pks):
        """
        Build a dict object from a discourse topic and its replies.

        Args:
        - connection_ids_pks: [{"connection_id": ..., "record_id": ...}]

        Returns:
        [
            {
                "type": "discourse_forum",
                "connection_id": ...,
                "record_id": ...,
                "title": ...,
                "slug": ...,
                "topic_id": ...,
                "created_at": ...,
                "replies": [
                    {
                        "author": ...,
                        "content": ...,
                        "post_number": ...,
                        "modified_time": ...,
                    },
                    ...
                ]
            },
            # {...}
        ]
        """
        connection_ids_pks_map = {}
        for connection_id_pk in connection_ids_pks:
            connection_id = connection_id_pk['connection_id']
            record_id = connection_id_pk['record_id']
            if connection_id not in connection_ids_pks_map:
                connection_ids_pks_map[connection_id] = [record_id]
            else:
                connection_ids_pks_map[connection_id].append(record_id)

        result = []
        for connection_id, _pks in connection_ids_pks_map.items():
            topics = self.get_topics_by_pks(connection_id, _pks)
            topics_replies_map = self.get_replies_by_topic_ids(
                connection_id, [topic['topic_id'] for topic in topics]
            )

            for topic_data in topics:
                whole_topic_data = {
                    'type': ConnectionType.DISCOURSE_FORUM.value,
                    'connection_id': int(connection_id),
                    'record_id': int(topic_data['_pk']),
                    'title': topic_data.get('title'),
                    'slug': topic_data.get('slug'),
                    'topic_id': topic_data.get('topic_id'),
                    'created_at': topic_data.get('created_time'),
                    'replies': []
                }

                replies = self._get_selected_topic_replies_for_attachment(
                    topics_replies_map.get(topic_data['topic_id'], []), ATTACHMENT_ISSUE_MAX_COMMENTS,
                )
                for reply in replies:
                    whole_topic_data['replies'].append({
                        'author': reply.get('author'),
                        'content': reply.get('content', ''),
                        'post_number': reply.get('post_number'),
                        'modified_time': reply.get('modified_time')
                    })

                result.append(whole_topic_data)
        return result

    def add_reply(self, project_uuid, connection_id, topic_id, reply_data):
        now = datetime.datetime.now(datetime.UTC).isoformat()
        replies_table_name = SchemaTables.DISCOURSE_REPLIES.table_name(connection_id)
        topics_table_name = SchemaTables.DISCOURSE_TOPICS.table_name(connection_id)

        reply_row = {
            SchemaTables.DISCOURSE_REPLIES.column.topic_id.name: topic_id,
            SchemaTables.DISCOURSE_REPLIES.column.post_number.name: reply_data.get('post_number', 0),
            SchemaTables.DISCOURSE_REPLIES.column.content.name: reply_data.get('content', ''),
            SchemaTables.DISCOURSE_REPLIES.column.author.name: reply_data.get('author', ''),
            SchemaTables.DISCOURSE_REPLIES.column.modified_time.name: now,
            SchemaTables.DISCOURSE_REPLIES.column.accepted_answer.name: False,
        }

        result = self.seadb_api.insert_rows(project_uuid, replies_table_name, [reply_row])
        pks = result.get('pks', [])

        self.seadb_api.update_rows(project_uuid, topics_table_name, [{
            'pk': int(reply_data.get('topic_pk', 0)),
            'row': {
                SchemaTables.DISCOURSE_TOPICS.column.record_modified_time.name: now,
            }
        }])

        return pks[0] if pks else None
