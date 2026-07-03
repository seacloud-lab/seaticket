import os
import sys
import logging
import requests
import base64
import argparse
sys.path.append('/opt/seaticket/seaqa-web')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
import django

django.setup()
from seahub.project.models import Projects
from seahub.settings import SEADB_SERVER_URL
from seahub.utils import uuid_str_to_36_chars

logger = logging.getLogger(__name__)


def parse_response(response):
    if response.status_code >= 400 or response.status_code < 200:
        raise ConnectionError(response.status_code, response.text)
    else:
        try:
            return response.json()
        except:
            return {}


class SeaDBAPI:
    def __init__(self, admin_username, admin_password, timeout=30):
        self.timeout = timeout
        self.server_url = SEADB_SERVER_URL
        self.headers = None
        self.admin_username = admin_username
        self.admin_password = admin_password
        self.gen_headers()

    def gen_headers(self):
        auth_str = f"{self.admin_username}:{self.admin_password}"
        b64 = base64.b64encode(auth_str.encode("utf-8")).decode()
        self.headers = {
            "Authorization": f"Basic {b64}"
        }
    
    def update_base_owner(self, base_id, username):
        base_id = uuid_str_to_36_chars(base_id)
        url = f'{self.server_url}/api/v1/{base_id}/base/update-base-owner'
        data = {
        "username": username,
        }

        response = requests.post(url, json=data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)


def get_projects_by_page(limit, start):
    return Projects.objects.order_by('id').values_list('uuid', flat=True)[start:start + limit]
    

def migrate_project_base_owner(args):
    admin_username = args.admin_username
    admin_password = args.admin_password
    seadb_username = args.seadb_username
    seadb_api = SeaDBAPI(admin_username, admin_password)
    limit = 1000
    start = 0
    while True:
        project_uuids = get_projects_by_page(limit, start)
        for project_uuid in project_uuids:
            logger.info('start to update owner for project %s', project_uuid)
            try:
                seadb_api.update_base_owner(project_uuid, seadb_username)
            except Exception as e:
                logger.exception("project_uuid:%s fail to update base owner error: %s", project_uuid, e)
        start += limit
        if len(project_uuids) < limit:
            break



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


def create_parser():
    parser = argparse.ArgumentParser(add_help=False)

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
        '--admin-username',
        dest='admin_username',
        help='admin username'
    )

    parser.add_argument(
        '--admin-password',
        dest='admin_password',
        help='admin password'
    )

    parser.add_argument(
        '--seadb-username',
        dest='seadb_username',
        help='username'
    )

    return parser


def main():
    parser = create_parser()
    args = parser.parse_args()
    init_logging(args)

    try:
        migrate_project_base_owner(args)
    except Exception as e:
        logger.exception(f"migrate seadb user failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

