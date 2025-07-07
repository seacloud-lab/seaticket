import json
import queue
import logging

import seahub.settings as settings
from seahub.constants import ETCD_ASSIGN_KEY_PREFIX, ETCD_SERVER_KEY_PREFIX
from seahub.utils import uuid_str_to_32_chars

try:
    import etcd3
except ImportError:
    etcd3 = None

NODE_URL_KEY = 'node_url'
LOCAL_NODE_URL_KEY = 'local_node_url'
NODE_ID_KEY = 'node_id'
enable_dtable_server_cluster = getattr(settings, 'ENABLE_DTABLE_SERVER_CLUSTER', False)
dtable_server_default = getattr(settings, 'DTABLE_SERVER_URL', 'http://127.0.0.1:5000/')
etcd_server_host = getattr(settings, 'ETCD_SERVER_HOST', 'localhost')
etcd_server_host_list = getattr(settings, 'ETCD_SERVER_HOST_LIST', [])
if not etcd_server_host_list:
    etcd_server_host_list = [etcd_server_host]

logger = logging.getLogger(__name__)


class EtcdConnectionPool(object):

    __instance = None

    def __new__(cls, *args, **kwargs):
        if cls.__instance is None:
            cls.__instance = super().__new__(cls)
        return cls.__instance

    def __init__(self):
        self.max_connections = 2 ** 20  # 1048576
        self.reset()

    def reset(self):
        self._available_connections = queue.Queue()
        self._created_connections = 0
        self._in_use_connections = set()

    def get_connection(self):
        """Get a connection from the pool"""
        if self._available_connections.qsize() == 0:
                connection = self.make_connection()
        else:
            try:
                connection = self._available_connections.get(timeout=0.1)
            except queue.Empty:
                connection = self.make_connection()
        self._in_use_connections.add(connection)
        return connection

    def make_connection(self):
        """Create a new connection"""
        if self._created_connections >= self.max_connections:
            raise ConnectionError('Too many etcd connections')

        connection = None
        for etcd_host in etcd_server_host_list:
            client = etcd3.client(host=etcd_host)
            try:
                # test connection
                client.get('etcd')
            except etcd3.exceptions.ConnectionFailedError:
                logger.warning('Connect etcd failed : ' + str(etcd_host))
                continue
            except Exception as e:
                logger.warning('Connect etcd exception : ' + str(etcd_host) + str(e))
                continue

            # success
            connection = client
            logger.info('Connect etcd success! : ' + str(etcd_host))
            break
        #
        if not connection:
            raise ConnectionError('Etcd server all down %s' % etcd_server_host_list)

        # ensure this connection is connected to Etcd
        connection.get('etcd')
        self._created_connections += 1
        logger.debug('etcd-created-connections: %s' % self._created_connections)
        return connection

    def release(self, connection):
        """Releases the connection back to the pool"""
        try:
            self._in_use_connections.remove(connection)
        except KeyError:
            pass
        self._available_connections.put(connection)
        return

    def disconnect(self, connection):
        """Disconnects the connection"""
        try:
            self._in_use_connections.remove(connection)
        except KeyError:
            pass
        self._created_connections -= 1
        connection.close()
        del connection
        return


class EtcdCacheClient(object):

    __instance = None

    def __new__(cls, *args, **kwargs):
        if cls.__instance is None:
            cls.__instance = super().__new__(cls)
        return cls.__instance

    def __init__(self):
        self.connection_pool = EtcdConnectionPool()

    def load_map_by_prefix(self, prefix):
        connection = self.connection_pool.get_connection()
        try:
            items_tuple = connection.get_prefix(prefix)
        except Exception as e:
            self.connection_pool.reset()
            raise e
        self.connection_pool.release(connection)
        items_map = {i[1].key.decode(): i[0].decode() for i in items_tuple}
        return items_map

    def get_etcd_value_by_key(self, key):
        connection = self.connection_pool.get_connection()
        try:
            value_tuple = connection.get(key)
        except Exception as e:
            self.connection_pool.reset()
            raise e
        self.connection_pool.release(connection)
        value = value_tuple[0]
        if not value:
            return ''
        return value.decode()


# etcd client init
if enable_dtable_server_cluster:
    etcd_cache_client = EtcdCacheClient()
else:
    etcd_cache_client = None


def get_server_by_dtable_uuid(project_uuid, is_local=False):
    if not enable_dtable_server_cluster:
        return dtable_server_default

    dtable_uuid_str = uuid_str_to_32_chars(project_uuid)
    # key such as 'assign-0f'
    dtable_server_mapping_key = ETCD_ASSIGN_KEY_PREFIX + dtable_uuid_str[:2]

    node_id = etcd_cache_client.get_etcd_value_by_key(
        dtable_server_mapping_key)
    servers_map = etcd_cache_client.load_map_by_prefix(ETCD_SERVER_KEY_PREFIX)
    info_str = servers_map.get(node_id)
    if not info_str:
        return ''

    info = json.loads(info_str)
    if is_local:
        return info.get(LOCAL_NODE_URL_KEY, '')
    else:
        return info.get(NODE_URL_KEY, '')


def list_servers_url():
    if not enable_dtable_server_cluster:
        return [dtable_server_default]

    servers = etcd_cache_client.load_map_by_prefix(ETCD_SERVER_KEY_PREFIX)
    servers_url = [json.loads(info).get(LOCAL_NODE_URL_KEY, '') for info in servers.values()]
    return servers_url


def map_server_buckets(servers_map, buckets_map):
    server_buckets = {server: set() for server in servers_map}
    for bucket, server in buckets_map.items():
        if server in server_buckets:
            server_buckets[server].add(bucket[len(ETCD_ASSIGN_KEY_PREFIX):])
    return server_buckets


def get_servers_info():
    if not enable_dtable_server_cluster:
        return []

    servers_map = etcd_cache_client.load_map_by_prefix(ETCD_SERVER_KEY_PREFIX)  # {node_id: info}
    buckets_map = etcd_cache_client.load_map_by_prefix(ETCD_ASSIGN_KEY_PREFIX)  # {bucket: node_id}
    server_buckets = map_server_buckets(servers_map, buckets_map)  # {node_id: buckets}
    info_list = []
    for server, info_str in servers_map.items():
        buckets = list(server_buckets.get(server, set()))
        info = json.loads(info_str)
        info['node_id'] = server
        info['assigned_keys'] = buckets
        info['assigned_keys_count'] = len(buckets)
        info_list.append(info)
    return info_list
