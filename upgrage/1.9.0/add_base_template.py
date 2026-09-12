import os
import sys
import logging
import argparse
import requests
import base64
sys.path.append('/opt/seaticket/seaqa-web')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
import django

django.setup()
from seahub.seadb_models.schema_loader import SCHEMA
from seahub.settings import SEADB_SERVER_URL, SEADB_USER, SEADB_PASSWORD

logger = logging.getLogger(__name__)


def init_logging(args):
    level = {
        'debug': logging.DEBUG,
        'info': logging.INFO,
        'warning': logging.WARNING,
        'error': logging.ERROR,
    }.get(args.loglevel, logging.INFO)
    format = '[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s %(funcName)s %(message)s'
    logging.basicConfig(
        format=format,
        datefmt='%Y-%m-%d %H:%M:%S',
        level=level,
        stream=args.logfile,
        force=True
    )


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
    
    def create_template(self, template_name, base_template):
        url = f'{self.server_url}/api/v1/templates'
        params = {
            'name': template_name,
            **base_template
        }
        response = requests.post(url, headers=self.headers, json=params,  timeout=self.timeout)
        return parse_response(response)


def add_base_template(template_name):
    base_template = {'name': template_name, 'tables': []}
    for _, table in SCHEMA.tables.items():
        template_table = {
            'name': table.table_name_schema.removesuffix('_{connection_id}'),
            'columns': [],
            'indexes': []
            }

        num = 0
        column_name_to_column_key = {}
        for _, column in table.column.items():
            column_info = {'key': f"{num:04d}", 'name': column.name, 'type': column.type}
            column_name_to_column_key[column_info.get('name')] = column_info.get('key')
            if column.data:
                cascade_column_name = column.data.get('cascade_column')
                if cascade_column_name:
                    column.data['cascade_column_key'] = column_name_to_column_key.get(cascade_column_name)
                    column.data.pop('cascade_column')

                column_info['data'] = column.data
            template_table['columns'].append(column_info)
            num += 1

        for index_column in table.indexes:
            index_info = {'columns': index_column}
            template_table['indexes'].append(index_info)
        
        base_template['tables'].append(template_table)
    seadb_api = SeaDBAPI()
    res = seadb_api.create_template(template_name, base_template)
    print(f"temlate base name is {res.get('name')}")
    print(f"temlate base name is {res.get('id')}")


def create_parser():
    parser = argparse.ArgumentParser(description='SeaQA upgrade connection_user Management Tool')

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

    parser.add_argument(
        '--template-name',
        required=True,
        help='Template name to create'
    )

    return parser


def main():
    parser = create_parser()
    args = parser.parse_args()
    init_logging(args)

    try:
        add_base_template(args.template_name)
    except Exception as e:
        logger.exception(f"upgrade connection_user table failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
