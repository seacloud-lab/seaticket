from seahub.seadb_models.models import KnowledgeBaseTable


TABLE_KNOWLEDGE_BASE = KnowledgeBaseTable.gen_table_name()


def get_knowledge_base_record_by_pk(seadb_api, project_uuid, record_number):
    sql = f"SELECT * FROM `{TABLE_KNOWLEDGE_BASE}` WHERE `_pk` = {record_number}"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows[0] if rows else None
