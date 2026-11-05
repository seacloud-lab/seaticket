import os
import re
import sys
import json
import logging
import argparse

sys.path.append('/opt/seaticket/seaqa-web')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
import django

django.setup()

from seahub.project.models import Projects
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import PropertyTypes

logger = logging.getLogger(__name__)

RUNS_TABLE = 'agent_runs'
ACTIONS_TABLE = 'agent_actions'

SUGGESTION_ACTION_TYPE = 'suggestion'

RUN_STATUS_COMPLETED = 'completed'
ACTION_STATUS_PENDING = 'pending'
ACTION_STATUS_EXECUTING = 'executing'
ACTION_STATUS_FAILED = 'failed'
SUGGESTIONS_STATUS_NONE = 'none'
SUGGESTIONS_STATUS_PENDING = 'pending'
SUGGESTIONS_STATUS_RESOLVED = 'resolved'
SUGGESTIONS_STATUS_FAILED = 'failed'

ROWS_UPDATE_BATCH_SIZE = 1000
QUERY_PAGE_SIZE = 500

MODIFY_TYPE_WITH_CURRENT_RE = re.compile(
    r'^type from "(.+?)" to "(.+?)" for this GitHub issue$'
)
MODIFY_TYPE_WITHOUT_CURRENT_RE = re.compile(
    r'^type to "(.+?)" for this GitHub issue$'
)
ASSIGN_LABELS_RE = re.compile(r'^labels (\[.*?\]) to this GitHub issue$')


def init_logging(args):
    level = {
        'debug': logging.DEBUG,
        'info': logging.INFO,
        'warning': logging.WARNING,
        'error': logging.ERROR,
    }.get(args.loglevel, logging.INFO)
    format = '[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s %(funcName)s %(message)s'
    logging.basicConfig(
        format=format,
        datefmt='%Y-%m-%d %H:%M:%S',
        level=level,
        stream=args.logfile,
        force=True
    )


class TableManager:
    def __init__(self, dry_run=False, project_uuid=None):
        self.seadb_api = SeaDBAPI()
        self.dry_run = dry_run
        self.only_project_uuid = str(project_uuid or '').strip()
        self.stats = {
            'projects_total': 0,
            'projects_succeeded': 0,
            'projects_skipped': 0,
            'projects_failed': 0,
            'runs_updated': 0,
            'actions_updated': 0,
            'owner_missing_runs': 0,
            'payload_backfilled': 0,
            'payload_parse_failed': 0,
        }

    # ---------- generic helpers ----------
    @staticmethod
    def _to_int(value):
        try:
            return int(value)
        except Exception:
            return None

    @staticmethod
    def _normalize_text(value):
        if value is None:
            return ''
        return str(value).strip()

    def _write(self, description, fn, *args, **kwargs):
        if self.dry_run:
            logger.info('[dry-run] %s', description)
            return None
        return fn(*args, **kwargs)

    def _iter_pages(self, query_fn):
        offset = 0
        while True:
            rows = query_fn(offset, QUERY_PAGE_SIZE) or []
            if not rows:
                break
            yield rows
            if len(rows) < QUERY_PAGE_SIZE:
                break
            offset += QUERY_PAGE_SIZE

    def _update_rows_in_batches(self, project_uuid, table_name, updates):
        if not updates:
            return 0
        updated_count = 0
        for start in range(0, len(updates), ROWS_UPDATE_BATCH_SIZE):
            chunk = updates[start:start + ROWS_UPDATE_BATCH_SIZE]
            self._write(
                f'update_rows table={table_name} size={len(chunk)}',
                self.seadb_api.update_rows,
                project_uuid,
                table_name,
                chunk,
            )
            updated_count += len(chunk)
        return updated_count

    # ---------- metadata helpers ----------
    def _get_base_metadata(self, project_uuid):
        return self.seadb_api.get_base_metadata(project_uuid) or {}

    @staticmethod
    def _get_table_meta(base_metadata, table_name):
        tables = (base_metadata or {}).get('tables') or []
        for table in tables:
            if table.get('name') == table_name:
                return table
        return None

    @staticmethod
    def _get_columns_by_name(table_meta):
        columns = (table_meta or {}).get('columns') or []
        return {column.get('name'): column for column in columns if isinstance(column, dict)}

    def _column_exists(self, table_meta, column_name):
        return column_name in self._get_columns_by_name(table_meta)

    def _column_key(self, table_meta, column_name):
        column = self._get_columns_by_name(table_meta).get(column_name)
        return column.get('key') if column else None

    def _index_exists_by_column_names(self, table_meta, column_names):
        columns_by_name = self._get_columns_by_name(table_meta)
        expected_keys = []
        for column_name in column_names:
            column = columns_by_name.get(column_name)
            if not column:
                return False
            expected_keys.append(column.get('key'))
        if any(key is None for key in expected_keys):
            return False

        indexes = (table_meta or {}).get('indexes') or {}
        if isinstance(indexes, dict):
            index_items = indexes.values()
        elif isinstance(indexes, list):
            index_items = indexes
        else:
            index_items = []
        expected_tuple = tuple(expected_keys)
        for index in index_items:
            if not isinstance(index, dict):
                continue
            index_keys = index.get('columns') or []
            if tuple(index_keys) == expected_tuple:
                return True
        return False

    # ---------- schema operations ----------
    def _ensure_column(self, project_uuid, table_meta, column_name, column_type):
        if self._column_exists(table_meta, column_name):
            return False
        self._write(
            f'add_column table={table_meta.get("name")} column={column_name}',
            self.seadb_api.add_column,
            project_uuid,
            table_meta['id'],
            {'column_name': column_name, 'column_type': column_type},
        )
        return True

    def _rename_column(self, project_uuid, table_meta, old_name, new_name):
        if self._column_exists(table_meta, new_name):
            return False
        old_key = self._column_key(table_meta, old_name)
        if not old_key:
            return False
        self._write(
            f'rename_column table={table_meta.get("name")} {old_name}->{new_name}',
            self.seadb_api.update_column,
            project_uuid,
            {
                'table_id': table_meta['id'],
                'column_key': old_key,
                'new_column_name': new_name,
            },
        )
        return True

    def _create_index_if_missing(self, project_uuid, table_meta, column_names):
        if self._index_exists_by_column_names(table_meta, column_names):
            return False
        self._write(
            f'create_index table={table_meta.get("name")} columns={column_names}',
            self.seadb_api.create_column_index,
            project_uuid,
            table_meta['id'],
            column_names,
        )
        return True

    def _delete_column_if_exists(self, project_uuid, table_meta, column_name):
        key = self._column_key(table_meta, column_name)
        if not key:
            return False
        self._write(
            f'delete_column table={table_meta.get("name")} column={column_name}',
            self.seadb_api.delete_column,
            project_uuid,
            table_meta['id'],
            key,
        )
        return True

    # ---------- data migration helpers ----------
    def _build_owner_by_run(self, project_uuid, actions_table_meta):
        if not actions_table_meta:
            return None
        required_columns = ['source_type', 'source_id', 'source_title']
        if not all(self._column_exists(actions_table_meta, name) for name in required_columns):
            logger.warning(
                'project %s skip owner backfill: legacy source_* columns not found in %s',
                project_uuid,
                ACTIONS_TABLE,
            )
            return None

        owner_by_run = {}

        def _query(offset, limit):
            sql = (
                "SELECT `run_id`, MAX(`source_id`) AS `sid`, MAX(`source_type`) AS `stype`, "
                "MAX(`source_title`) AS `stitle` "
                f"FROM `{ACTIONS_TABLE}` "
                f"WHERE `action_type` != '{SUGGESTION_ACTION_TYPE}' "
                "GROUP BY `run_id` "
                "ORDER BY `run_id` ASC "
                f"LIMIT {offset}, {limit}"
            )
            result = self.seadb_api.query_rows(project_uuid, sql)
            return result.get('results', [])

        for rows in self._iter_pages(_query):
            for row in rows:
                run_id = self._to_int(row.get('run_id'))
                if run_id is None:
                    continue
                owner_by_run[run_id] = {
                    'owner_source_type': self._normalize_text(row.get('stype')),
                    'owner_source_id': self._normalize_text(row.get('sid')),
                    'owner_source_title': self._normalize_text(row.get('stitle')),
                }
        return owner_by_run

    def _build_suggestions_status_by_run(self, project_uuid):
        statuses_by_run = {}

        def _query(offset, limit):
            sql = (
                "SELECT `run_id`, `status`, COUNT(*) AS `bucket_size` "
                f"FROM `{ACTIONS_TABLE}` "
                f"WHERE `action_type` = '{SUGGESTION_ACTION_TYPE}' "
                "GROUP BY `run_id`, `status` "
                "ORDER BY `run_id` ASC, `status` ASC "
                f"LIMIT {offset}, {limit}"
            )
            result = self.seadb_api.query_rows(project_uuid, sql)
            return result.get('results', [])

        for rows in self._iter_pages(_query):
            for row in rows:
                run_id = self._to_int(row.get('run_id'))
                if run_id is None:
                    continue
                status = self._normalize_text(row.get('status'))
                statuses_by_run.setdefault(run_id, set()).add(status)

        suggestions_status_by_run = {}
        for run_id, statuses in statuses_by_run.items():
            if any(status in (ACTION_STATUS_PENDING, ACTION_STATUS_EXECUTING) for status in statuses):
                suggestions_status_by_run[run_id] = SUGGESTIONS_STATUS_PENDING
            elif ACTION_STATUS_FAILED in statuses:
                suggestions_status_by_run[run_id] = SUGGESTIONS_STATUS_FAILED
            else:
                suggestions_status_by_run[run_id] = SUGGESTIONS_STATUS_RESOLVED
        return suggestions_status_by_run

    @staticmethod
    def _normalize_event_if_needed(raw_event):
        if raw_event in (None, ''):
            return None
        parsed_event = raw_event
        if isinstance(raw_event, str):
            try:
                parsed_event = json.loads(raw_event)
            except Exception:
                return None
        if isinstance(parsed_event, list):
            normalized = parsed_event[0] if parsed_event else None
            if not isinstance(normalized, dict):
                return ''
            return json.dumps(normalized, ensure_ascii=False)
        return None

    @staticmethod
    def _parse_payload(raw_payload):
        if isinstance(raw_payload, dict):
            return raw_payload
        if not isinstance(raw_payload, str) or not raw_payload.strip():
            return {}
        try:
            payload = json.loads(raw_payload)
        except Exception:
            return {}
        return payload if isinstance(payload, dict) else {}

    @staticmethod
    def _parse_modify_type_payload(suggestion_text):
        text = str(suggestion_text or '').strip()
        if not text:
            return None
        with_current_match = MODIFY_TYPE_WITH_CURRENT_RE.match(text)
        if with_current_match:
            current_issue_type = with_current_match.group(1).strip()
            suggested_type = with_current_match.group(2).strip()
            if suggested_type:
                return {
                    'current_issue_type': current_issue_type,
                    'suggested_type': suggested_type,
                }
            return None
        without_current_match = MODIFY_TYPE_WITHOUT_CURRENT_RE.match(text)
        if without_current_match:
            suggested_type = without_current_match.group(1).strip()
            if suggested_type:
                return {
                    'current_issue_type': '',
                    'suggested_type': suggested_type,
                }
        return None

    @staticmethod
    def _parse_assign_labels_payload(suggestion_text):
        text = str(suggestion_text or '').strip()
        if not text:
            return None
        match = ASSIGN_LABELS_RE.match(text)
        if not match:
            return None
        try:
            labels = json.loads(match.group(1))
        except Exception:
            return None
        if not isinstance(labels, list):
            return None
        normalized_labels = []
        for label in labels:
            label_text = str(label).strip()
            if label_text:
                normalized_labels.append(label_text)
        if not normalized_labels:
            return None
        return {'suggested_labels': normalized_labels}

    # ---------- migration phases ----------
    def _phase1_runs_schema(self, project_uuid):
        base_metadata = self._get_base_metadata(project_uuid)
        runs_table_meta = self._get_table_meta(base_metadata, RUNS_TABLE)
        if not runs_table_meta:
            return None

        updated = False
        for column_name in [
            'owner_source_type',
            'owner_source_id',
            'owner_source_title',
            'suggestions_status',
        ]:
            updated = self._ensure_column(
                project_uuid, runs_table_meta, column_name, PropertyTypes.TEXT
            ) or updated
        updated = self._rename_column(project_uuid, runs_table_meta, 'events', 'event') or updated
        if updated and not self.dry_run:
            base_metadata = self._get_base_metadata(project_uuid)
            runs_table_meta = self._get_table_meta(base_metadata, RUNS_TABLE)
        self._create_index_if_missing(
            project_uuid,
            runs_table_meta,
            ['owner_source_type', 'owner_source_id'],
        )
        return runs_table_meta

    def _phase2_runs_backfill(self, project_uuid):
        base_metadata = self._get_base_metadata(project_uuid)
        runs_table_meta = self._get_table_meta(base_metadata, RUNS_TABLE)
        actions_table_meta = self._get_table_meta(base_metadata, ACTIONS_TABLE)
        if not runs_table_meta or not actions_table_meta:
            return

        owner_by_run = self._build_owner_by_run(project_uuid, actions_table_meta)
        suggestions_status_by_run = self._build_suggestions_status_by_run(project_uuid)

        select_fields = ['`_pk`']
        for field_name in [
            'owner_source_type',
            'owner_source_id',
            'owner_source_title',
            'suggestions_status',
            'event',
        ]:
            if self._column_exists(runs_table_meta, field_name):
                select_fields.append(f'`{field_name}`')
        select_clause = ', '.join(select_fields)

        owner_missing_runs = 0
        owner_missing_logged = set()

        def _query_runs(offset, limit):
            sql = (
                f"SELECT {select_clause} "
                f"FROM `{RUNS_TABLE}` "
                "ORDER BY `_pk` ASC "
                f"LIMIT {offset}, {limit}"
            )
            result = self.seadb_api.query_rows(project_uuid, sql)
            return result.get('results', [])

        for rows in self._iter_pages(_query_runs):
            updates = []
            for row in rows:
                run_id = self._to_int(row.get('_pk'))
                if run_id is None:
                    continue
                row_update = {}

                if owner_by_run is not None:
                    owner_data = owner_by_run.get(run_id)
                    if owner_data is None:
                        owner_data = {
                            'owner_source_type': '',
                            'owner_source_id': '',
                            'owner_source_title': '',
                        }
                        if run_id not in owner_missing_logged:
                            owner_missing_logged.add(run_id)
                            owner_missing_runs += 1
                            logger.warning(
                                'project %s run %s has no non-suggestion actions; owner_source_* left empty',
                                project_uuid,
                                run_id,
                            )
                    for key in ('owner_source_type', 'owner_source_id', 'owner_source_title'):
                        if key not in row:
                            continue
                        current_value = self._normalize_text(row.get(key))
                        desired_value = self._normalize_text(owner_data.get(key))
                        if current_value != desired_value:
                            row_update[key] = desired_value

                if 'suggestions_status' in row:
                    desired_suggestions_status = suggestions_status_by_run.get(
                        run_id, SUGGESTIONS_STATUS_NONE
                    )
                    current_suggestions_status = self._normalize_text(
                        row.get('suggestions_status')
                    )
                    if current_suggestions_status != desired_suggestions_status:
                        row_update['suggestions_status'] = desired_suggestions_status

                if 'event' in row:
                    normalized_event = self._normalize_event_if_needed(row.get('event'))
                    if normalized_event is not None and normalized_event != row.get('event'):
                        row_update['event'] = normalized_event

                if row_update:
                    updates.append({'pk': run_id, 'row': row_update})

            updated_count = self._update_rows_in_batches(project_uuid, RUNS_TABLE, updates)
            self.stats['runs_updated'] += updated_count

        self.stats['owner_missing_runs'] += owner_missing_runs

    def _phase3_actions_schema(self, project_uuid):
        base_metadata = self._get_base_metadata(project_uuid)
        actions_table_meta = self._get_table_meta(base_metadata, ACTIONS_TABLE)
        if not actions_table_meta:
            return None

        updated = False
        for column_name in [
            'target_item_type',
            'target_item_id',
            'target_item_title',
            'suggestion_payload',
        ]:
            updated = self._ensure_column(
                project_uuid, actions_table_meta, column_name, PropertyTypes.TEXT
            ) or updated
        updated = self._rename_column(
            project_uuid, actions_table_meta, 'sources', 'references'
        ) or updated
        if updated and not self.dry_run:
            base_metadata = self._get_base_metadata(project_uuid)
            actions_table_meta = self._get_table_meta(base_metadata, ACTIONS_TABLE)
        return actions_table_meta

    def _phase4_actions_backfill(self, project_uuid):
        base_metadata = self._get_base_metadata(project_uuid)
        actions_table_meta = self._get_table_meta(base_metadata, ACTIONS_TABLE)
        if not actions_table_meta:
            return

        has_source_columns = all(
            self._column_exists(actions_table_meta, column_name)
            for column_name in ('source_type', 'source_id', 'source_title')
        )
        has_target_columns = all(
            self._column_exists(actions_table_meta, column_name)
            for column_name in ('target_item_type', 'target_item_id', 'target_item_title')
        )
        has_suggestion_text = self._column_exists(actions_table_meta, 'suggestion_text')
        has_suggestion_payload = self._column_exists(actions_table_meta, 'suggestion_payload')

        select_fields = ['`_pk`', '`tool_name`']
        if has_source_columns:
            select_fields.extend(['`source_type`', '`source_id`', '`source_title`'])
        if has_target_columns:
            select_fields.extend(['`target_item_type`', '`target_item_id`', '`target_item_title`'])
        if has_suggestion_text:
            select_fields.append('`suggestion_text`')
        if has_suggestion_payload:
            select_fields.append('`suggestion_payload`')
        select_clause = ', '.join(select_fields)

        payload_backfilled = 0
        payload_parse_failed = 0

        def _query_suggestion_actions(offset, limit):
            sql = (
                f"SELECT {select_clause} "
                f"FROM `{ACTIONS_TABLE}` "
                f"WHERE `action_type` = '{SUGGESTION_ACTION_TYPE}' "
                "ORDER BY `_pk` ASC "
                f"LIMIT {offset}, {limit}"
            )
            result = self.seadb_api.query_rows(project_uuid, sql)
            return result.get('results', [])

        for rows in self._iter_pages(_query_suggestion_actions):
            updates = []
            for row in rows:
                action_id = self._to_int(row.get('_pk'))
                if action_id is None:
                    continue
                row_update = {}

                if has_source_columns and has_target_columns:
                    desired_target_type = self._normalize_text(row.get('source_type'))
                    desired_target_id = self._normalize_text(row.get('source_id'))
                    desired_target_title = self._normalize_text(row.get('source_title'))
                    if self._normalize_text(row.get('target_item_type')) != desired_target_type:
                        row_update['target_item_type'] = desired_target_type
                    if self._normalize_text(row.get('target_item_id')) != desired_target_id:
                        row_update['target_item_id'] = desired_target_id
                    if self._normalize_text(row.get('target_item_title')) != desired_target_title:
                        row_update['target_item_title'] = desired_target_title

                if has_suggestion_text and has_suggestion_payload:
                    tool_name = self._normalize_text(row.get('tool_name'))
                    current_payload = self._parse_payload(row.get('suggestion_payload'))
                    parsed_payload = None
                    payload_parse_attempted = False
                    if tool_name == 'suggest_modify_type':
                        if not current_payload.get('suggested_type'):
                            payload_parse_attempted = True
                            parsed_payload = self._parse_modify_type_payload(
                                row.get('suggestion_text')
                            )
                    elif tool_name == 'suggest_assign_labels':
                        labels = current_payload.get('suggested_labels')
                        if not (isinstance(labels, list) and len(labels) > 0):
                            payload_parse_attempted = True
                            parsed_payload = self._parse_assign_labels_payload(
                                row.get('suggestion_text')
                            )

                    if parsed_payload:
                        payload_backfilled += 1
                        row_update['suggestion_payload'] = json.dumps(
                            parsed_payload, ensure_ascii=False
                        )
                    elif payload_parse_attempted:
                        payload_parse_failed += 1
                        logger.warning(
                            'project %s action %s tool %s failed to parse suggestion_text into payload',
                            project_uuid,
                            action_id,
                            tool_name,
                        )

                if row_update:
                    updates.append({'pk': action_id, 'row': row_update})

            updated_count = self._update_rows_in_batches(project_uuid, ACTIONS_TABLE, updates)
            self.stats['actions_updated'] += updated_count

        self.stats['payload_backfilled'] += payload_backfilled
        self.stats['payload_parse_failed'] += payload_parse_failed

    def _phase5_drop_legacy_columns(self, project_uuid):
        base_metadata = self._get_base_metadata(project_uuid)
        runs_table_meta = self._get_table_meta(base_metadata, RUNS_TABLE)
        actions_table_meta = self._get_table_meta(base_metadata, ACTIONS_TABLE)

        if actions_table_meta:
            for column_name in [
                'source_type',
                'source_id',
                'source_title',
                'suggestion_text',
            ]:
                self._delete_column_if_exists(project_uuid, actions_table_meta, column_name)

        if runs_table_meta:
            self._delete_column_if_exists(project_uuid, runs_table_meta, 'items_processed')
            # Usually events -> event is a rename. This is only a safety cleanup.
            if (
                self._column_exists(runs_table_meta, 'events')
                and self._column_exists(runs_table_meta, 'event')
            ):
                self._delete_column_if_exists(project_uuid, runs_table_meta, 'events')

    # ---------- project loop ----------
    def get_projects_by_page(self, limit, start):
        return Projects.objects.order_by('id').values_list('uuid', flat=True)[start:start + limit]

    def _get_target_project_uuids(self):
        if self.only_project_uuid:
            return [self.only_project_uuid]
        limit = 1000
        start = 0
        all_project_uuids = []
        while True:
            project_uuids = list(self.get_projects_by_page(limit, start))
            if not project_uuids:
                break
            all_project_uuids.extend(str(project_uuid) for project_uuid in project_uuids)
            start += limit
            if len(project_uuids) < limit:
                break
        return all_project_uuids

    def migrate_project(self, project_uuid):
        base_metadata = self._get_base_metadata(project_uuid)
        runs_table_meta = self._get_table_meta(base_metadata, RUNS_TABLE)
        actions_table_meta = self._get_table_meta(base_metadata, ACTIONS_TABLE)
        if not runs_table_meta or not actions_table_meta:
            logger.warning(
                'project %s missing %s or %s, skip',
                project_uuid,
                RUNS_TABLE,
                ACTIONS_TABLE,
            )
            self.stats['projects_skipped'] += 1
            return

        self._phase1_runs_schema(project_uuid)
        self._phase2_runs_backfill(project_uuid)
        self._phase3_actions_schema(project_uuid)
        self._phase4_actions_backfill(project_uuid)
        self._phase5_drop_legacy_columns(project_uuid)
        self.stats['projects_succeeded'] += 1
        logger.info('finish migrate project_uuid: %s agent_runs/agent_actions tables', project_uuid)

    def update(self):
        project_uuids = self._get_target_project_uuids()
        self.stats['projects_total'] = len(project_uuids)
        for project_uuid in project_uuids:
            logger.info(
                'start to migrate agent tables for project %s (dry_run=%s)',
                project_uuid,
                self.dry_run,
            )
            try:
                self.migrate_project(str(project_uuid))
            except Exception as error:
                self.stats['projects_failed'] += 1
                logger.exception(
                    'project_uuid:%s fail to migrate agent tables error: %s',
                    project_uuid,
                    error,
                )
        logger.info('migration summary: %s', self.stats)


def create_parser():
    parser = argparse.ArgumentParser(
        description='SeaQA non-destructive upgrade for agent_runs and agent_actions'
    )
    parser.add_argument(
        '--logfile',
        default=sys.stdout,
        type=argparse.FileType('a'),
        help='Log file path (default: stdout)'
    )
    parser.add_argument(
        '--loglevel',
        default='info',
        choices=['debug', 'info', 'warning', 'error'],
        help='Logging level (default: info)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run in read-only mode and only log intended changes.'
    )
    parser.add_argument(
        '--project-uuid',
        default='',
        help='Only migrate one project UUID (default: all projects).'
    )
    return parser


def main():
    parser = create_parser()
    args = parser.parse_args()
    init_logging(args)
    try:
        table_manager = TableManager(
            dry_run=args.dry_run,
            project_uuid=args.project_uuid,
        )
        table_manager.update()
    except Exception as error:
        logger.exception('upgrade agent tables failed: %s', error)
        sys.exit(1)


if __name__ == "__main__":
    main()
