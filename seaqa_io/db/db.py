# -*- coding: utf-8 -*-
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import sessionmaker

from seaqa_io.log import setup_logger

logger = setup_logger('seaqa_io', propagate=False)


class Base(DeclarativeBase):
    pass


def create_engine_from_conf(configs):
    host = configs.get('SEAQA_MYSQL_DB_HOST', 'localhost')
    port = configs.get('SEAQA_MYSQL_DB_PORT', 3306)
    username = configs.get('SEAQA_MYSQL_DB_USER', 'seaqa')
    password = configs.get('SEAQA_MYSQL_DB_PASSWORD', '')
    db_name = configs.get('SEAQA_MYSQL_SEAQA_DB_NAME', 'sea_qa')

    db_url = 'mysql+mysqldb://%s:%s@%s:%s/%s?charset=utf8' % (
        username, quote_plus(password), host, port, db_name
    )
    logger.debug('[seaqa_io] database: mysql, name: %s', db_name)

    kwargs = dict(pool_recycle=300, pool_pre_ping=True, echo=False, echo_pool=False)
    engine = create_engine(db_url, **kwargs)
    return engine


def init_db_session_class(configs):
    try:
        engine = create_engine_from_conf(configs)
    except Exception as e:
        logger.error('Init db session class error: %s', e)
        raise RuntimeError('Init db session class error: %s' % e)

    session = sessionmaker(bind=engine)
    return session
