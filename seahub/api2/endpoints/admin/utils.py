import logging

from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.settings import DTABLE_SERVER_URL, \
    USE_INNER_DTABLE_SERVER, INNER_DTABLE_SERVER_URL, INNER_DTABLE_DB_URL
from seahub.utils.utils_etcd import list_servers_url, enable_dtable_server_cluster
from seahub.utils.dtable_storage_server_api import storage_api

logger = logging.getLogger(__name__)


def get_dtable_server_info(username):
    if enable_dtable_server_cluster:
        servers_url = list_servers_url()
    else:
        server_url = INNER_DTABLE_SERVER_URL if USE_INNER_DTABLE_SERVER else DTABLE_SERVER_URL
        servers_url = [server_url]

    infos_list = []
    for dtable_server_url in servers_url:
        infos = {
            "enable_cluster": False,
            "web_socket_count": 0,
            "operation_count_since_up": 0,
            "loaded_dtables_count": 0,
            "last_period_operations_count": 0,
        }

        try:
            dtable_server_api = DTableServerAPI(username, None, dtable_server_url)
            sys_info = dtable_server_api.get_sys_info()
            infos.update(sys_info)
        except Exception as e:
            logger.exception('user: %s get dtable server info error: %s', username, e)
        infos_list.append(infos)

    return infos_list

def get_base_archives_stats():
    dtable_db_api = DTableDBAPI(None, None, INNER_DTABLE_DB_URL)
    try:
        return dtable_db_api.get_stats()
    except Exception as e:
        logger.exception('get dtable db stats error: %s', e)
        return None

def get_dtable_size(dtable):

    if dtable.in_storage:
        try:
            file_size = int(storage_api.get_dtable_size(str(dtable.uuid)))
        except:
            file_size = None

    else:
        file_size = None

    return file_size
