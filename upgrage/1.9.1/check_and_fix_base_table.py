#!/usr/bin/env python3
"""Check columns in all Seadb bases against the template base."""

import logging
import re
from typing import Any
import os
import sys

sys.path.append('/opt/seaticket/seaqa-web')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
import django

django.setup()
from seahub.seadb_models.schema_loader import SCHEMA
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.models import Projects

logger = logging.getLogger(__name__)


TABLE_SUFFIX_PATTERN = re.compile(r"_\d+$")


def table_columns(table: Any) -> set[str]:
    if not isinstance(table, dict) or not isinstance(table.get("columns"), list):
        return set()
    return {
        column["name"]
        for column in table["columns"]
        if isinstance(column, dict) and isinstance(column.get("name"), str) and column.get('key') != '_pk'
    }

def get_autual_table_column_info(table: Any) -> dict[str, str]:
    if not isinstance(table, dict) or not isinstance(table.get("columns"), list):
        return {}
    return {
        column["name"]: column['key']
        for column in table["columns"]
        if isinstance(column, dict) and isinstance(column.get("name"), str) and column.get('key') != '_pk'
    }


def build_template_tables(metadata: dict[str, Any]) -> dict[str, set[str]]:
    template_tables: dict[str, set[str]] = {}
    for table in metadata["tables"]:
        if not isinstance(table, dict) or not isinstance(table.get("name"), str):
            logger.warning("Template Base contains a table without a valid name; skipping it.")
            continue
        template_tables[table["name"]] = table_columns(table)
    return template_tables


def find_template_name(
    table_name: str,
    template_tables: dict[str, set[str]],
) -> str | None:
    if table_name in template_tables:
        return table_name

    template_name = TABLE_SUFFIX_PATTERN.sub("", table_name)
    if template_name in template_tables:
        return template_name

    return None


def check_base(
    seadb_api,
    base_id: str,
    template_tables: dict[str, set[str]],
):
    metadata = seadb_api.get_base_metadata(base_id)

    for table in metadata["tables"]:
        if not isinstance(table, dict) or not isinstance(table.get("name"), str):
            logger.warning(
                "Base %s contains a table without a valid name; skipping it.", base_id
            )
            continue

        table_name = table["name"]
        actual_columns = table_columns(table)
        template_name = find_template_name(table_name, template_tables)
        table_id = table.get('id')
        if template_name is None:
            seadb_api.delete_table(base_id, table_id)
            logger.warning(
                "Table %s in Base %s has no matching template table, delete it.",
                table_name,
                base_id,
            )
            continue

        expected_columns = template_tables[template_name]
        extra_columns = sorted(actual_columns - expected_columns)
        missing_columns = sorted(expected_columns - actual_columns)
        if missing_columns:
            seadb_api.delete_table(base_id, table_id)
            logger.info('delete miss column table %s in Base %s', table_name, base_id)
            continue
        if extra_columns:
            actual_table_column_name_to_key_dict = get_autual_table_column_info(table)
            for column_name in extra_columns:
                column_key = actual_table_column_name_to_key_dict.get(column_name)
                if column_key:
                    seadb_api.delete_column(base_id, table_id, column_key)
                    logger.info('delete extra column %s table %s in Base %s', column_name, table_name, base_id)

    return


def get_base_template():
    base_template = {'tables': []}
    for _, table in SCHEMA.tables.items():
        template_table = {
            'name': table.table_name_schema.removesuffix('_{connection_id}'),
            'columns': [],
            'indexes': []
            }

        num = 0
        column_name_to_column_key = {}
        for _, column in table.column.items():
            column_info = {'key': f"{num:04d}", 'name': column.name, 'type': column.type}
            column_name_to_column_key[column_info.get('name')] = column_info.get('key')
            if column.data:
                cascade_column_name = column.data.get('cascade_column')
                if cascade_column_name:
                    column.data['cascade_column_key'] = column_name_to_column_key.get(cascade_column_name)
                    column.data.pop('cascade_column')

                column_info['data'] = column.data
            template_table['columns'].append(column_info)
            num += 1

        for index_column in table.indexes:
            index_info = {'columns': index_column}
            template_table['indexes'].append(index_info)
        
        base_template['tables'].append(template_table)

    return base_template


def get_projects_by_page(limit, start):
        return Projects.objects.order_by('id').values_list('uuid', flat=True)[start:start + limit]


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s %(funcName)s %(message)s",
        stream=sys.stdout,
        force=True,
    )

    try:
        template_metadata = get_base_template()
        template_tables = build_template_tables(template_metadata)
    except (OSError, RuntimeError) as exc:
        logger.error("Failed to initialize check: %s", exc, exc_info=True)
        return 1


    differences: dict[str, dict[str, dict[str, Any]]] = {}
    failed_base_ids: list[str] = []
    seadb_api = SeaDBAPI()

    limit = 1000
    start = 0
    base_ids = []
    while True:
        project_uuids = get_projects_by_page(limit, start)
        for base_id in project_uuids:
            base_id = str(base_id)
            base_ids.append(base_id)
            logger.info("Checking Base %s...", base_id)
            try:
                base_differences = check_base(seadb_api, base_id, template_tables)
            except (OSError, RuntimeError) as exc:
                failed_base_ids.append(base_id)
                logger.error("Failed to check Base %s: %s", base_id, exc, exc_info=True)
                continue

            if base_differences:
                differences[base_id] = base_differences
                logger.info(
                    "Finished checking Base %s; %d table(s) have differences or no matching template.",
                    base_id,
                    len(base_differences),
                )
            else:
                logger.info("Finished checking Base %s; no column differences found.", base_id)
        start += limit
        if len(project_uuids) < limit:
            break


    logger.info(
        "Check and fix completed: processed %d Base(s)",
        len(base_ids)
    )
    if failed_base_ids:
        logger.error(
            "%d Base check(s) failed: %s",
            len(failed_base_ids),
            ", ".join(failed_base_ids),
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
