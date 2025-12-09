# -*- coding: utf-8 -*-

import datetime
import logging
from django.core.management.base import BaseCommand

from seahub.project.models import ProjectConnections
from seahub.project.constants import ConnectionType
from seahub.project.utils import generate_ai_summary, submit_summary_index_task
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import DiscourseRepliesTable, EmailTable
from seahub.utils import uuid_str_to_32_chars
from seahub.seadb_models.utils import get_connection_table_name

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Repair missing AI summaries and vectors for connection records'

    def add_arguments(self, parser):
        parser.add_argument(
            'project_uuid',
            type=str,
            help='Project UUID (required)',
        )
        parser.add_argument(
            '--connection-id',
            type=int,
            help='Only repair records for a specific connection (optional)',
        )

    def handle(self, **options):
        project_uuid = options['project_uuid']
        connection_id = options.get('connection_id')

        self.stdout.write('Starting AI summary repair process...')

        connections_query = ProjectConnections.objects.filter(
            deleted=False,
            is_active=True,
            project__uuid=project_uuid
        )

        if connection_id:
            self.stdout.write(f'Filtering by connection ID: {connection_id}')
            connections_query = connections_query.filter(id=connection_id)

        connections = connections_query.select_related('project', 'project__workspace')
        total_connections = connections.count()

        if total_connections == 0:
            self.stdout.write('No connections found matching the criteria.')
            return

        self.stdout.write(f'Found {total_connections} connections to process.')

        processed_count = 0
        repaired_count = 0
        error_count = 0
        indexed_connections = []

        for connection in connections:
            processed_count += 1
            self.stdout.write(
                f'\n[{processed_count}/{total_connections}] Processing connection: '
                f'{connection.name} (ID: {connection.id}, Type: {connection.type})'
            )

            try:
                repaired = self.repair_connection_records(connection)
                repaired_count += repaired

                if repaired > 0:
                    indexed_connections.append(connection.id)

            except Exception as e:
                error_count += 1
                logger.error(f'Error processing connection {connection.id}: {str(e)}')
                self.stdout.write(f'Error: {str(e)}')

        index_success_count = 0
        index_error_count = 0

        if indexed_connections:
            self.stdout.write(
                f'\nSubmitting index tasks for {len(indexed_connections)} connections...\n'
            )

            for connection_id in indexed_connections:
                try:
                    submit_summary_index_task(connection_id)
                    index_success_count += 1
                    self.stdout.write(
                        f'Submitted index task for connection {connection_id}'
                    )
                except Exception as e:
                    index_error_count += 1
                    logger.error(f'Failed to submit index task for connection {connection_id}: {str(e)}')
                    self.stdout.write(f'Failed to submit index task for connection {connection_id}: {str(e)}')

        self.stdout.write(
            f'\n'
            f'Repair process completed!\n'
            f'Total connections processed: {processed_count}\n'
            f'Total records repaired: {repaired_count}\n'
            f'Errors encountered: {error_count}\n'
            f'Index tasks submitted: {index_success_count}\n'
            f'Index task errors: {index_error_count}\n'
        )

    def repair_connection_records(self, connection):
        project = connection.project
        project_uuid = str(project.uuid)
        project_uuid_32 = uuid_str_to_32_chars(project_uuid)

        workspace = project.workspace
        username = workspace.owner
        
        org_id = workspace.org_id if hasattr(workspace, 'org_id') else -1

        table_name = get_connection_table_name(connection)
        if not table_name:
            self.stdout.write(
                f'Skipping: Unsupported connection type {connection.type}'
            )
            return 0

        seadb_api = SeaDBAPI(username)
        connection_type = connection.type

        sql = f"""
            SELECT * FROM `{table_name}`
            WHERE ai_summary IS NULL OR ai_summary = ''
                OR ai_summary_vector IS NULL
        """

        repaired_count = 0
        offset = 0
        batch_size = 100

        while True:
            paginated_sql = f"{sql.strip()} LIMIT {batch_size} OFFSET {offset}"

            try:
                result = seadb_api.query_rows(project_uuid_32, paginated_sql)
            except Exception as e:
                logger.error(f'Error querying records: {str(e)}')
                break

            if not result or not result.get('results'):
                break

            records = result.get('results', [])
            if not records:
                break

            self.stdout.write(f'Processing batch: {len(records)} records (offset: {offset})')

            update_datas = []
            for record in records:
                try:
                    pk = record.get('_pk')
                    title = record.get('title', '')
                    topic_id = record.get('topic_id')
                    content = record.get('content', '')
                    if connection_type == ConnectionType.DISCOURSE_FORUM.value:
                        discourse_reply_table_name = DiscourseRepliesTable.gen_table_name(connection.id)
                        reply_sql = f"SELECT topic_id, content FROM `{discourse_reply_table_name}` WHERE topic_id = {topic_id} ORDER BY post_number ASC LIMIT 1"
                        result = seadb_api.query_rows(project_uuid_32, reply_sql).get('results', [])
                        content = result[0].get('content', '') if result else ''
                    elif connection_type == ConnectionType.EMAIL.value:
                        email_table_name = EmailTable.gen_table_name(connection.id)
                        email_sql = f"SELECT content FROM `{email_table_name}` WHERE _pk = {pk}"
                        result = seadb_api.query_rows(project_uuid_32, email_sql).get('results', [])
                        content = result[0].get('content', '') if result else ''

                    text_content = f"Title: {title}\n\nBody: {content}\n"

                    self.stdout.write(f'Generating AI summary for record {pk}...')
                    ai_summary, vector = generate_ai_summary(
                        content=text_content,
                        username=username,
                        connection_type=connection.type,
                        project_uuid=project_uuid,
                        org_id=org_id,
                        include_vector=True
                    )
                    current_time = datetime.datetime.now(datetime.UTC).isoformat()

                    update_data = {
                        "pk": pk,
                        "row": {
                            "ai_summary": ai_summary,
                            "ai_summary_vector": vector,
                            "ai_processed_time": current_time
                        }
                    }
                    update_datas.append(update_data)

                except Exception as e:
                    logger.error(f'Error repairing record {pk}: {str(e)}')
                    self.stdout.write(f'Failed to repair record {pk}: {str(e)}')

            if update_datas:
                try:
                    seadb_api.update_rows(project_uuid_32, table_name, update_datas)
                    repaired_count += len(update_datas)
                    self.stdout.write(f'Repaired {len(update_datas)} records in this batch.')
                except Exception as e:
                    logger.error(f'Error updating records: {str(e)}')
                    self.stdout.write(f'Failed to update records: {str(e)}')
            if len(records) < batch_size:
                break
          
            offset += batch_size

        self.stdout.write(f'Repaired {repaired_count} records for connection {connection.id}')

        return repaired_count
