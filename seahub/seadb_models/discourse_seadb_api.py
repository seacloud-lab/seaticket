import logging
import datetime

from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import DiscourseTopicsTable, DiscourseRepliesTable
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE, ATTACHMENT_ISSUE_MAX_COMMENTS
from seahub.project.constants import ConnectionType


logger = logging.getLogger(__name__)

class DiscourseSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_topics_by_connection_id(self, connection_id, start, limit):
        """Retrieve all topics for the specified connection_id."""
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
        sql = f"SELECT `_pk`, `topic_id`, `title`, `slug`, `views`, `modified_time`, `created_time`, `resolved`, `linked_ticket`, `deleted`, `outdated` FROM `{table_name}` WHERE (`deleted` = False OR `deleted` IS NULL) LIMIT {limit} OFFSET {start}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_topic_by_pk(self, connection_id, _pk):
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
        sql = f"SELECT `title`, `topic_id`, `slug` FROM `{table_name}` WHERE `_pk` = {_pk} AND (`deleted` = False OR `deleted` IS NULL)"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response and response['results']:
            return response['results'][0]
        return {}

    def get_replies_by_topic_id(self, connection_id, topic_id):
        """Retrieve all replies for the specified topic_id."""
        table_name = DiscourseRepliesTable.gen_table_name(connection_id)
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
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
        sql = f"SELECT `_pk`, `topic_id`, `title`, `slug`, `created_time` FROM `{table_name}` WHERE `_pk` in ({_pks_str}) AND (`deleted` = False OR `deleted` IS NULL)"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])

    def get_replies_by_topic_ids(self, connection_id, topic_ids, limit_for_each_id):
        table_name = DiscourseRepliesTable.gen_table_name(connection_id)
        sql = f"SELECT `topic_id`, `post_number`, `content`, `author`, `modified_time`, `accepted_answer` FROM `{table_name}` WHERE `topic_id` in ({', '.join(topic_ids)}) ORDER BY `post_number` ASC LIMIT 0, {len(topic_ids) * limit_for_each_id}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        replies = response.get('results', [])
        result = {}
        for reply in replies:
            topic_id = reply['topic_id']
            if topic_id not in result:
                result[topic_id] = [reply]
            elif len(result[topic_id]) < limit_for_each_id:
                result[topic_id].append(reply)
        return result

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

            topic_ids_str = [str(topic['topic_id']) for topic in topics]
            topics_replies_map = self.get_replies_by_topic_ids(connection_id, topic_ids_str, ATTACHMENT_ISSUE_MAX_COMMENTS)

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

                total_content_size = 0
                for reply in topics_replies_map.get(topic_data['topic_id'], []):
                    content = reply.get('content', '')
                    total_content_size += len(content)

                    # break if exceed maximum content size
                    if total_content_size > ATTACHMENT_CONTENT_MAX_SIZE:
                        break

                    whole_topic_data['replies'].append({
                        'author': reply.get('author'),
                        'content': content,
                        'post_number': reply.get('post_number'),
                        'modified_time': reply.get('modified_time')
                    })

                result.append(whole_topic_data)
        return result

    def add_reply(self, project_uuid, connection_id, topic_id, reply_data):
        now = datetime.datetime.now(datetime.UTC).isoformat()
        replies_table_name = DiscourseRepliesTable.gen_table_name(connection_id)
        topics_table_name = DiscourseTopicsTable.gen_table_name(connection_id)

        reply_row = {
            DiscourseRepliesTable.topic_id.name: topic_id,
            DiscourseRepliesTable.post_number.name: reply_data.get('post_number', 0),
            DiscourseRepliesTable.content.name: reply_data.get('content', ''),
            DiscourseRepliesTable.author.name: reply_data.get('author', ''),
            DiscourseRepliesTable.modified_time.name: now,
            DiscourseRepliesTable.accepted_answer.name: False,
        }

        result = self.seadb_api.insert_rows(project_uuid, replies_table_name, [reply_row])
        pks = result.get('pks', [])

        self.seadb_api.update_rows(project_uuid, topics_table_name, [{
            'pk': int(reply_data.get('topic_pk', 0)),
            'row': {
                DiscourseTopicsTable.record_modified_time.name: now,
            }
        }])

        return pks[0] if pks else None
