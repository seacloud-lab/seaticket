from sqlalchemy import text

from seaqa_io.utils import uuid_str_to_32_chars


class SeaqaDB(object):
    def __init__(self, db_session_class):
        self.db_session_class = db_session_class

    def get_connection_by_ids(self, project_uuid, connection_ids):
        project_uuid = uuid_str_to_32_chars(project_uuid)
        with self.db_session_class() as session:
            sql = """SELECT pc.id, pc.type, pc.config
            FROM project_connection pc
            INNER JOIN projects p
            ON p.uuid=pc.project_uuid WHERE p.deleted=false AND pc.deleted=false AND pc.project_uuid=:project_uuid"""

            params = {'project_uuid': project_uuid}
            if connection_ids:
                sql += ' AND pc.id in :connection_ids'
                params['connection_ids'] = connection_ids

            return session.execute(text(sql), params).fetchall()
