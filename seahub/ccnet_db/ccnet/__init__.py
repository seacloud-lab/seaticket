import configparser
import os
from seahub.ccnet_db import appconfig

if not (db_name := os.getenv('SEATABLE_MYSQL_DB_CCNET_DB_NAME')):
    parser = configparser.ConfigParser()
    parser.read(appconfig.ccnet_conf_path)

    if parser.has_section('Database'):
        db_name = parser.get('Database', 'DB', fallback='ccnet')
    else:
        db_name = 'ccnet'
