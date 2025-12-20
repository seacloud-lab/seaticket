import logging

from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import DiscourseTopicsTable, DiscourseRepliesTable
from seahub.settings import AI_CHAT_GITHUB_ISSUE_MAX_COMMENTS_NUM


logger = logging.getLogger(__name__)


class DiscourseSeaDBAPI:
    def __init__(self, base_id, username='', timeout=30):
        self.base_id = base_id
        self.seadb_api = SeaDBAPI(username=username, timeout=timeout)

    def get_topics_by_connection_id(self, connection_id, start, limit):
        """Retrieve all topics for the specified connection_id."""
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `deleted` = False LIMIT {limit} OFFSET {start}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_topic_by_pk(self, connection_id, _pk):
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` = {_pk} AND `deleted` = False"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_replies_by_topic_id(self, connection_id, topic_id):
        """Retrieve all replies for the specified topic_id."""
        table_name = DiscourseRepliesTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `topic_id` = {topic_id}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_topics_by_pks(self, connection_id, _pks):
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` in ({', '.join(_pks)}) AND `deleted` = False"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])

    def get_replies_by_topic_ids(self, connection_id, topic_ids, limit_for_each_id):
        table_name = DiscourseRepliesTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `topic_id` in ({', '.join(topic_ids)}) ORDER BY `post_number` ASC LIMIT 0, {len(topic_ids) * limit_for_each_id}"
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

    def get_whole_issues_data(self, connection_ids_pks):
        """
        Build a dict object from a discourse topic and its replies.

        Args:
        - connection_ids_pks: [{"connection_id": ..., "_pk": ...}]

        Returns:
        [
            {
                "type": "issue",
                "connection_id": ...,
                "issue_id": ...,
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
            issue_id = connection_id_pk['issue_id']
            if connection_id not in connection_ids_pks_map:
                connection_ids_pks_map[connection_id] = [issue_id]
            else:
                connection_ids_pks_map[connection_id].append(issue_id)

        result = []
        for connection_id, _pks in connection_ids_pks_map.items():
            _pks_str = [str(pk) for pk in _pks]
            topics = self.get_topics_by_pks(connection_id, _pks_str)

            topic_ids_str = [str(topic['topic_id']) for topic in topics]
            topics_replies_map = self.get_replies_by_topic_ids(connection_id, topic_ids_str, AI_CHAT_GITHUB_ISSUE_MAX_COMMENTS_NUM)

            for topic_data in topics:
                whole_topic_data = {
                    'type': 'issue',
                    'connection_id': int(connection_id),
                    'issue_id': int(topic_data['_pk']),
                    'title': topic_data.get('title'),
                    'slug': topic_data.get('slug'),
                    'topic_id': topic_data.get('topic_id'),
                    'created_at': topic_data.get('created_time'),
                    'replies': []
                }

                for reply in topics_replies_map.get(topic_data['topic_id'], []):
                    whole_topic_data['replies'].append({
                        'author': reply.get('author'),
                        'content': reply.get('content'),
                        'post_number': reply.get('post_number'),
                        'modified_time': reply.get('modified_time')
                    })

                result.append(whole_topic_data)
        return result
