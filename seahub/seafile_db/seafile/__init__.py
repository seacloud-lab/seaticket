import configparser
import os

from seahub.seafile_db import appconfig

if not (db_name := os.getenv('SEATABLE_MYSQL_DB_SEAFILE_DB_NAME')):
    parser = configparser.ConfigParser()
    parser.read(appconfig.seafile_conf_path)

    if parser.has_section('database'):
        db_name = parser.get('database', 'db_name', fallback='seafile')
    else:
        db_name = 'seafile'
