import os
from pathlib import Path

import pytest


def _mysql_connect(host, user, password, port, database=None):
    try:
        import MySQLdb  # type: ignore

        return MySQLdb.connect(
            host=host,
            user=user,
            passwd=password,
            port=port,
            db=database,
            charset='utf8mb4',
        )
    except Exception:
        import pymysql  # type: ignore

        return pymysql.connect(
            host=host,
            user=user,
            password=password,
            port=port,
            database=database,
            charset='utf8mb4',
            autocommit=True,
        )


def _run_sql_file(db_conn, sql_path: Path):
    sql_text = sql_path.read_text(encoding='utf-8')
    statements = [s.strip() for s in sql_text.split(';') if s.strip()]

    cur = db_conn.cursor()
    try:
        for stmt in statements:
            cur.execute(stmt)
    finally:
        try:
            cur.close()
        except Exception:
            pass


@pytest.fixture(scope='session')
def django_db_setup(django_db_blocker):
    if os.environ.get('SEAQA_SKIP_MYSQL_INIT', '').lower() in {'1', 'true', 'yes'}:
        return

    test_db_name = os.environ.get('SEAQA_TEST_DB_NAME', 'test_sea_qa')
    sql_path = Path(__file__).resolve().parent / 'sql' / 'mysql.sql'

    from django.conf import settings

    db_conf = settings.DATABASES['default']
    host = db_conf.get('HOST') or '127.0.0.1'
    user = db_conf.get('USER') or 'root'
    password = db_conf.get('PASSWORD') or ''
    port = int(db_conf.get('PORT') or 3306)

    settings.DATABASES['default']['NAME'] = test_db_name

    with django_db_blocker.unblock():
        admin_conn = _mysql_connect(host=host, user=user, password=password, port=port)
        try:
            cur = admin_conn.cursor()
            try:
                cur.execute(f'DROP DATABASE IF EXISTS `{test_db_name}`')
                cur.execute(f'CREATE DATABASE `{test_db_name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci')
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
        finally:
            try:
                admin_conn.close()
            except Exception:
                pass

        db_conn = _mysql_connect(host=host, user=user, password=password, port=port, database=test_db_name)
        try:
            _run_sql_file(db_conn, sql_path)
        finally:
            try:
                db_conn.close()
            except Exception:
                pass

        from django.db import connections

        connections.close_all()
        connections['default'].ensure_connection()
