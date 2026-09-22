import os
import sys
import logging
import argparse
import requests
import base64
from copy import deepcopy
from urllib.parse import quote

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
import django

django.setup()
from seahub.seadb_models.schema_loader import SCHEMA
from seahub.settings import SEADB_SERVER_URL, SEADB_USER, SEADB_PASSWORD
from seahub.constants import TEMPLATE_NAME

logger = logging.getLogger(__name__)


def parse_response(response):
    if response.status_code >= 400 or response.status_code < 200:
        raise ConnectionError(response.status_code, response.text)
    else:
        try:
            return response.json()
        except:
            pass


class SeaDBAPI:
    def __init__(self, timeout=30):
        self.timeout = timeout
        self.server_url = SEADB_SERVER_URL
        self.headers = None
        self.gen_headers()

    def gen_headers(self):
        auth_str = f"{SEADB_USER}:{SEADB_PASSWORD}"
        b64 = base64.b64encode(auth_str.encode("utf-8")).decode()
        self.headers = {
            "Authorization": f"Basic {b64}"
        }
    
    def create_table(self, base_name, table_name):
        url = f'{self.server_url}/api/v1/{quote(base_name)}/tables'
        params = {
            'table_name': str(table_name)
        }
        response = requests.post(url, headers=self.headers, json=params, timeout=self.timeout)
        return parse_response(response)
    
    def create_column_index(self, base_name, table_id, columns):
        url = f'{self.server_url}/api/v1/{quote(base_name)}/index'
        data = {
            'table_id': table_id,
            'columns': columns,
        }
        response = requests.post(url, json=data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)
    
    def add_column(self, base_name, table_id, column):
        url = f'{self.server_url}/api/v1/{quote(base_name)}/columns'
        data = {
            'table_id': table_id,
            'column_name': column['column_name'],
            'column_type': column['column_type'],
        }
        if column.get('column_data'):
            data['column_data'] = column['column_data']
        response = requests.post(url, json=data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)


def add_template_tables(template_name):
    seadb_api = SeaDBAPI()

    for _, schema_table in SCHEMA.tables.items():
        table_name = schema_table.table_name_schema.removesuffix('_{connection_id}')
        res = seadb_api.create_table(template_name, table_name)
        table_id = res['table_id'] # type: ignore

        # Build cascade mapping from column-level cascade_column declarations
        cascade_map = {}  # target_column_name -> source_column_name
        for column in schema_table.get_fields():
            column_name = column.name
            cascade_column_name = column.data.get('cascade_column')

            if cascade_column_name:
                cascade_map[column_name] = cascade_column_name
        cascade_source_columns = set(cascade_map.values())
        source_column_keys = {}  # source_column_name -> seadb_key

        for column in schema_table.get_fields():
            column_name = column.name
            mapped_column = deepcopy(column.to_dict())

            # If this column is a cascade target and we have the source's SeaDB key, inject it
            if column_name in cascade_map:
                source_col_name = cascade_map[column_name]
                source_key = source_column_keys.get(source_col_name)
                if source_key:
                    mapped_column.setdefault('column_data', {})
                    mapped_column['column_data']['cascade_column_key'] = source_key
                # Remove the YAML-only hint from data sent to SeaDB
                mapped_column.get('column_data', {}).pop('cascade_column', None)
            added_column = seadb_api.add_column(template_name, table_id, mapped_column)

            # Record the SeaDB key if this column acts as a cascade source
            if column_name in cascade_source_columns:
                source_column_keys[column_name] = added_column['column_key'] # type: ignore

        for index_item in schema_table.indexes:
            seadb_api.create_column_index(template_name, table_id, index_item)


def create_parser():
    parser = argparse.ArgumentParser(description='SeaQA add template base tables Management Tool')

    parser.add_argument(
        '--logfile',
        default=sys.stdout,
        type=argparse.FileType('a'),
        help='Log file path (default: stdout)'
    )

    parser.add_argument(
        '--loglevel',
        default='info',
        choices=['debug', 'info', 'warning', 'error'],
        help='Logging level (default: info)'
    )

    return parser


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s %(funcName)s %(message)s",
        stream=sys.stdout,
        force=True,
    )

    try:
        add_template_tables(TEMPLATE_NAME)
    except Exception as e:
        logger.exception(f"add template base tables failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
