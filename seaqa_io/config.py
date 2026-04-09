# -*- coding: utf-8 -*-
import json
import os
import yaml

from seaqa_io.log import setup_logger

logger = setup_logger('seaqa_io', propagate=False)


def _read_yaml(yaml_file_path=None, component_name=None):
    if yaml_file_path:
        configs = {}
        try:
            with open(yaml_file_path, 'r', encoding='utf-8') as yaml_file:
                current_yaml_config = yaml.safe_load(yaml_file)
                configs = current_yaml_config.get('global', {})
                if component_name:
                    component_config = current_yaml_config.get(component_name, {})
                    configs.update(component_config)
                    if 'from_yaml' in component_config:
                        del configs['from_yaml']
                        configs.update(_read_yaml(component_config['from_yaml']))
        except Exception as e:
            logger.error('Failure to read YAML config file: %s', e)
        return configs
    return {}


def _check_type(func):
    def wrapper(self, key, default=None, check_type=True):
        result = func(self, key, default)
        if check_type:
            need_type = type(default)
            if need_type in (int, float):
                try:
                    result = need_type(result)
                except Exception:
                    raise ValueError(f'Type of {key} must be a number')
            elif need_type == bool:
                if isinstance(result, str):
                    result = result.lower() in ('true', '1')
                else:
                    result = bool(result)
            elif need_type in (str, list, dict):
                result = need_type(result)
        return result
    return wrapper


class ConfigParser(object):
    def __init__(self, yaml_file_path, component_name):
        assert yaml_file_path and component_name, 'yaml_file_path and component_name must be specified'
        self.refresh_yaml_configs(yaml_file_path, component_name)

    def refresh_yaml_configs(self, yaml_file_path=None, component_name=None):
        self.yaml_file_path = yaml_file_path or self.yaml_file_path
        self.component_name = component_name or self.component_name
        self.yaml_configs = _read_yaml(self.yaml_file_path, self.component_name)

    @_check_type
    def get(self, key, default=None):
        if key in os.environ:
            value = os.getenv(key)
            try:
                value = json.loads(value)
            except Exception:
                pass
            return value
        return self.yaml_configs.get(key, default)


CONF_DIR = os.getenv('CONF_PATH', '/opt/seaqa/conf/')
yaml_file_path = os.path.join(CONF_DIR, os.environ.get('SEAQA_CONFIG_NAME', 'seaqa_config.yaml'))
configs = ConfigParser(yaml_file_path, 'seaqa-io')

JWT_PRIVATE_KEY = configs.get('JWT_PRIVATE_KEY')
SEADB_SERVER_URL = configs.get('SEADB_SERVER_URL', 'http://seadb:8888')
SEADB_SERVER_ACCESS_TOKEN = configs.get('SEADB_SERVER_ACCESS_TOKEN', '')

SEAQA_IO_WORKERS = configs.get('SEAQA_IO_WORKERS', 3)
SEAQA_IO_TASK_TIMEOUT = configs.get('SEAQA_IO_TASK_TIMEOUT', 3600)

TEMP_EXPORT_VIEW_DIR = configs.get('TEMP_EXPORT_VIEW_DIR', '/tmp/seaqa-io/export-view-to-excel/')

SEAQA_MYSQL_DB_HOST = configs.get('SEAQA_MYSQL_DB_HOST', 'localhost')
SEAQA_MYSQL_DB_PORT = configs.get('SEAQA_MYSQL_DB_PORT', 3306)
SEAQA_MYSQL_DB_USER = configs.get('SEAQA_MYSQL_DB_USER', 'seaqa')
SEAQA_MYSQL_DB_PASSWORD = configs.get('SEAQA_MYSQL_DB_PASSWORD', '')
SEAQA_MYSQL_SEAQA_DB_NAME = configs.get('SEAQA_MYSQL_SEAQA_DB_NAME', 'sea_qa')

REDIS_HOST = configs.get('REDIS_HOST', 'redis')
REDIS_PORT = configs.get('REDIS_PORT', 6379)
REDIS_PASSWORD = configs.get('REDIS_PASSWORD', '')
