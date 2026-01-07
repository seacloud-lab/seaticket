import logging

import json
from seahub.project.utils import url_to_filename, get_file_from_s3_web_crawl
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import WebCrawlTable

logger = logging.getLogger(__name__)


class SiteSeaDBAPI:
    def __init__(self, base_id, username='', timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(username=username, timeout=timeout)

    def get_sites_by_pks(self, connection_id, pks):
        """Retrieve issue for the specified _pk."""
        table_name = WebCrawlTable.gen_table_name(connection_id)
        pks_str = ', '.join([
            str(pk)
            for pk in pks
        ])
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` in ({pks_str}) AND (`deleted` = False OR `deleted` IS NULL)"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_whole_sites_data(self, project_uuid, connection_ids_pks):
        """
        Build a dict object from an email thread and its emails.

        Args:
        - connection_ids_pks: [{"connection_id": ..., "record_id": ...}]

        Returns:
        [
            {
                "type": "site",
                "connection_id": ...,
                "record_id": ...,
                "title": ...,
                "url": ...,
                "content": ...
            },
            # {...}
        ]
        """
        connection_ids_pks_map = {}
        for connection_id_pk in connection_ids_pks:
            connection_id = connection_id_pk['connection_id']
            document_id = connection_id_pk['record_id']
            if connection_id not in connection_ids_pks_map:
                connection_ids_pks_map[connection_id] = [document_id]
            else:
                connection_ids_pks_map[connection_id].append(document_id)

        result = []
        project_uuid_to_s3 = project_uuid.replace('-', '')
        for connection_id, document_ids in connection_ids_pks_map.items():
            current_sites = self.get_sites_by_pks(connection_id, document_ids)
            for site in current_sites:
                file_obj = get_file_from_s3_web_crawl(project_uuid_to_s3, connection_id, url_to_filename(site['url']))
                if file_obj:
                    content = json.loads(file_obj.read())['content']
                    result.append({
                        'type': 'site',
                        'connection_id': connection_id,
                        'record_id': site['_pk'],
                        'title': site['title'],
                        'url': site['url'],
                        'content': content
                    })
        return result
