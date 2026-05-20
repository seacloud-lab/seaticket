import logging
import os
import threading

import yaml
from django.conf import settings

logger = logging.getLogger(__name__)

_SCHEMA_LOCK = threading.Lock()
_SCHEMA_CACHE = None


def _schema_file_path():
    return getattr(settings, 'SEADB_TABLE_SCHEMA_PATH', None)


def preload_seadb_table_schemas():
    global _SCHEMA_CACHE
    if _SCHEMA_CACHE is not None:
        return _SCHEMA_CACHE

    with _SCHEMA_LOCK:
        if _SCHEMA_CACHE is not None:
            return _SCHEMA_CACHE
        yaml_path = _schema_file_path()
        if not yaml_path or not os.path.isfile(yaml_path):
            logger.warning(f'Seadb table schema file not found: {yaml_path}, using empty schema.')
            _SCHEMA_CACHE = {}
            return _SCHEMA_CACHE
        logger.info(f'Loading seadb table schemas from: {yaml_path}')
        with open(yaml_path, 'r', encoding='utf-8') as fp:
            _SCHEMA_CACHE = yaml.safe_load(fp) or {}
    return _SCHEMA_CACHE


def get_seadb_table_schemas():
    return preload_seadb_table_schemas()
