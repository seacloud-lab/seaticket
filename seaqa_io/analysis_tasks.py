import logging

import numpy as np
from sklearn.manifold import TSNE

from seahub.project.constants import ConnectionType
from seahub.project.models import ProjectConnections
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.utils import get_connection_table_name


logger = logging.getLogger('seaqa_io')

MAX_EMBEDDING_ANALYSIS_RECORDS = 100000



def list_connection_records_with_columns(seadb_api, project_uuid, connection, column_names, limit,
                                         extra_columns=None, start_year=None, end_year=None):
    table_name = get_connection_table_name(connection)
    if not table_name:
        return []

    column_join = ', '.join(['`%s`' % column_name for column_name in column_names])
    if extra_columns:
        extra_parts = ', '.join([f"'{v}' as `{k}`" for k, v in extra_columns.items()])
        column_join = f"{column_join}, {extra_parts}"

    sql = f"SELECT {column_join} FROM `{table_name}`"
    conditions = []
    if start_year:
        conditions.append(f"`modified_time` >= '{start_year}-01-01'")
    if end_year:
        conditions.append(f"`modified_time` <= '{end_year}-12-31'")
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += f" LIMIT {limit}"

    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
    except Exception as e:
        logger.error('Failed to list connection records: %s', e)
        records = []
    return records


def perform_embedding_analysis(project_uuid, connection_ids, username, start_year=None, end_year=None):
    try:
        seadb_api = SeaDBAPI(username)
        all_records = []

        if isinstance(connection_ids, str):
            connection_ids = [cid.strip() for cid in connection_ids.split(',') if cid.strip()]

        connections = ProjectConnections.objects.filter(
            project_id=project_uuid,
            id__in=connection_ids,
            deleted=False,
        )
        connection_map = {conn.id: conn for conn in connections}

        for cid in connection_ids:
            connection = connection_map.get(cid)
            if not connection:
                continue

            remaining = MAX_EMBEDDING_ANALYSIS_RECORDS - len(all_records)
            if remaining <= 0:
                break

            column_names = ['_pk', 'title', 'ai_summary', 'ai_summary_vector']
            if connection.type == ConnectionType.GITHUB_ISSUE.value:
                column_names.extend(['url', 'state'])

            records = list_connection_records_with_columns(
                seadb_api,
                project_uuid,
                connection,
                column_names,
                remaining,
                extra_columns={
                    'connection_id': connection.id,
                    'connection_type': connection.type,
                },
                start_year=start_year,
                end_year=end_year,
            )
            all_records.extend(records)

        if not all_records:
            logger.warning('No records found for embedding analysis')
            return {'records': []}

        valid_records = []
        vectors = []

        for record in all_records:
            ai_summary = record.get('ai_summary')
            ai_summary_vector = record.get('ai_summary_vector')
            if ai_summary and ai_summary_vector:
                record.pop('ai_summary_vector', None)
                valid_records.append(record)
                vectors.append(ai_summary_vector)

        if not vectors:
            logger.warning('No records with embeddings found')
            return {'records': []}

        embeddings_2d = generate_embeddings_2d_with_tsne(vectors)
        for i, record in enumerate(valid_records):
            if i < len(embeddings_2d):
                record['x'] = embeddings_2d[i][0]
                record['y'] = embeddings_2d[i][1]

        return {
            'records': valid_records,
        }

    except Exception as e:
        logger.error('Error in embedding analysis: %s', e)
        raise


def generate_embeddings_2d_with_tsne(vectors):
    if not vectors:
        return []
    
    embeddings_array = np.array(vectors)

    perplexity = min(30, len(embeddings_array) - 1)
    if perplexity < 1:
        perplexity = 5
    
    tsne = TSNE(n_components=2, random_state=42, perplexity=perplexity)
    embeddings_2d = tsne.fit_transform(embeddings_array)
    
    result = []
    for i in range(len(embeddings_2d)):
        coords = [float(embeddings_2d[i][0]), float(embeddings_2d[i][1])]
        result.append(coords)
    
    return result
