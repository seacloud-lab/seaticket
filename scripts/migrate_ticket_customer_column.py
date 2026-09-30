"""Add the tickets.customer_id column to every existing project SeaDB base.

New projects pick the column up from the server-side `template` base, which is
updated separately with:

    scripts/manage_column.sh add-column \
        --table-name tickets --column-name customer_id --column-type int64 --need-add-index true

Every base created before that change already has its own `tickets` table, so it
needs this one-off backfill. The script is idempotent: a base that already has the
column is skipped, so it is safe to re-run after a partial failure.

Order of operations: update the template base, run this script, then deploy the
code that reads and writes the column. Ticket detail, trash and the type/substate
drill-downs select `customer_id` explicitly and will fail until every base has it.

Usage:
    python scripts/migrate_ticket_customer_column.py --dry-run
    python scripts/migrate_ticket_customer_column.py
    python scripts/migrate_ticket_customer_column.py --project-uuid <uuid>
    python scripts/migrate_ticket_customer_column.py --backfill
"""
import argparse
import json
import logging
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')

import django  # noqa: E402

django.setup()

from seahub.project.models import Projects  # noqa: E402
from seahub.project.seadb_api import SeaDBAPI  # noqa: E402
from seahub.seadb_models.models import PropertyTypes, SchemaTables  # noqa: E402
from seahub.tickets.ticket_utils import to_optional_int  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manage_seadb_column import ColumnManager  # noqa: E402


logger = logging.getLogger(__name__)

COLUMN_NAME = SchemaTables.TICKETS.column.customer_id.name
TICKETS_TABLE_NAME = SchemaTables.TICKETS.table_name()
PORTAL_ISSUES_TABLE_NAME = SchemaTables.PORTAL_ISSUES.table_name()

# Outcome of migrating a single base. NO_TICKETS_TABLE and ALREADY_PRESENT are
# both "nothing to do" and must not be reported as a failure.
ADDED = 'added'
ALREADY_PRESENT = 'already_present'
NO_TICKETS_TABLE = 'no_tickets_table'
FAILED = 'failed'


def get_table_metadata(seadb_api, base_name, table_name):
    metadata = seadb_api.get_base_metadata(base_name)
    for table in metadata.get('tables') or []:
        if table.get('name') == table_name:
            return table
    return None


def has_column(table_metadata, column_name):
    columns = (table_metadata or {}).get('columns') or []
    return any(column.get('name') == column_name for column in columns)


def get_project_uuids(project_uuid=None):
    """Project bases are keyed by the project uuid. Soft-deleted projects keep
    their base, so they are included."""
    projects = Projects.objects.all()
    if project_uuid:
        projects = projects.filter(uuid=project_uuid)
    return [str(uuid) for uuid in projects.values_list('uuid', flat=True)]


def add_column_to_base(base_name, dry_run=False):
    """Returns one of ADDED / ALREADY_PRESENT / NO_TICKETS_TABLE / FAILED.

    A base without a tickets table is not a failure: it predates the tickets
    feature entirely, so there is nothing to migrate and it must not make the
    script report a failed run.
    """
    table_metadata = get_table_metadata(SeaDBAPI(), base_name, TICKETS_TABLE_NAME)
    if not table_metadata:
        logger.warning('%s: no `%s` table in this base, skipping', base_name, TICKETS_TABLE_NAME)
        return NO_TICKETS_TABLE

    if has_column(table_metadata, COLUMN_NAME):
        logger.info('%s: `%s` already exists, skipping', base_name, COLUMN_NAME)
        return ALREADY_PRESENT

    if dry_run:
        logger.info('%s: would add `%s`', base_name, COLUMN_NAME)
        return ADDED

    # ColumnManager logs and swallows failures, so the result is verified below
    # rather than trusted from the call itself.
    ColumnManager().add_seadb_column(
        TICKETS_TABLE_NAME, COLUMN_NAME, PropertyTypes.INT, None, True, base_name=base_name)

    table_metadata = get_table_metadata(SeaDBAPI(), base_name, TICKETS_TABLE_NAME)
    if not has_column(table_metadata, COLUMN_NAME):
        logger.error('%s: `%s` is still missing after the add-column call', base_name, COLUMN_NAME)
        return FAILED
    logger.info('%s: added `%s`', base_name, COLUMN_NAME)
    return ADDED


def extract_portal_issue_ids(linked_connection_records):
    if isinstance(linked_connection_records, str):
        try:
            linked_connection_records = json.loads(linked_connection_records)
        except ValueError:
            return []
    issue_ids = []
    for record in linked_connection_records or []:
        if not isinstance(record, str) or not record.startswith('portal_'):
            continue
        suffix = record.split('_', 1)[1]
        if suffix.isdigit():
            issue_ids.append(int(suffix))
    return issue_ids


def backfill_base(base_name, batch_size, dry_run=False):
    """Fill customer_id on tickets that are linked to a portal issue which has a
    customer and where the ticket has none yet. Only fills NULLs, so a manually
    chosen customer is never overwritten and the script is resumable."""
    seadb_api = SeaDBAPI()
    # Deliberately a loose pre-filter: `_` is a single-character wildcard in SQL
    # LIKE, so this also matches e.g. `portalX...`. It only narrows the scan;
    # extract_portal_issue_ids does the strict `portal_<digits>` check in Python.
    # Do not "fix" this with \_ or ESCAPE -- the escape character differs between
    # dialects, and a wrong one would silently turn this into a literal-backslash
    # search and match nothing.
    sql = (
        f"SELECT `_pk`, `linked_connection_records` FROM `{TICKETS_TABLE_NAME}` "
        f"WHERE `{COLUMN_NAME}` IS NULL AND `linked_connection_records` LIKE '%portal_%'"
    )
    try:
        tickets = seadb_api.query_rows(base_name, sql).get('results') or []
    except Exception as e:
        logger.error('%s: failed to read tickets for backfill: %s', base_name, e)
        return 0, 1

    ticket_to_issue_ids = {}
    issue_ids = set()
    for ticket in tickets:
        found = extract_portal_issue_ids(ticket.get('linked_connection_records'))
        if not found:
            continue
        ticket_to_issue_ids[int(ticket['_pk'])] = found
        issue_ids.update(found)

    if not issue_ids:
        return 0, 0

    ids_str = ','.join(str(issue_id) for issue_id in sorted(issue_ids))
    issue_sql = f"SELECT `_pk`, `{COLUMN_NAME}` FROM `{PORTAL_ISSUES_TABLE_NAME}` WHERE `_pk` IN ({ids_str})"
    try:
        issues = seadb_api.query_rows(base_name, issue_sql).get('results') or []
    except Exception as e:
        logger.error('%s: failed to read portal issues for backfill: %s', base_name, e)
        return 0, 1

    issue_id_to_customer = {
        int(issue['_pk']): to_optional_int(issue.get(COLUMN_NAME)) for issue in issues
    }

    updates = []
    for ticket_id, linked_issue_ids in ticket_to_issue_ids.items():
        customer_id = next(
            (issue_id_to_customer.get(issue_id) for issue_id in linked_issue_ids
             if issue_id_to_customer.get(issue_id)), None)
        if customer_id:
            updates.append({'pk': ticket_id, 'row': {COLUMN_NAME: customer_id}})

    if not updates:
        return 0, 0

    if dry_run:
        logger.info('%s: would backfill %s ticket(s)', base_name, len(updates))
        return len(updates), 0

    filled, failed = 0, 0
    for start in range(0, len(updates), batch_size):
        batch = updates[start:start + batch_size]
        try:
            seadb_api.update_rows(base_name, TICKETS_TABLE_NAME, batch)
            filled += len(batch)
        except Exception as e:
            failed += len(batch)
            logger.error('%s: backfill batch failed: %s', base_name, e)
    logger.info('%s: backfilled %s ticket(s), %s failed', base_name, filled, failed)
    return filled, failed


def create_parser():
    parser = argparse.ArgumentParser(description='Add tickets.customer_id to existing project bases')
    parser.add_argument('--project-uuid', dest='project_uuid', help='Only migrate this project')
    parser.add_argument('--dry-run', dest='dry_run', action='store_true', help='Report without writing')
    parser.add_argument('--backfill', action='store_true',
                        help='Also inherit the customer from linked portal issues')
    parser.add_argument('--batch-size', dest='batch_size', type=int, default=200,
                        help='Rows per update when backfilling (default: 200)')
    parser.add_argument('--logfile', default=sys.stdout, type=argparse.FileType('a'),
                        help='Log file path (default: stdout)')
    parser.add_argument('--loglevel', default='info',
                        choices=['debug', 'info', 'warning', 'error'], help='Logging level')
    return parser


def main():
    args = create_parser().parse_args()
    logging.basicConfig(
        level=getattr(logging, args.loglevel.upper()),
        format='[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s %(funcName)s %(message)s',
        stream=args.logfile,
        force=True,
    )

    project_uuids = get_project_uuids(args.project_uuid)
    if not project_uuids:
        logger.error('No projects matched, nothing to do')
        return 1

    logger.info('Checking %s project base(s)%s', len(project_uuids), ' (dry run)' if args.dry_run else '')

    added, skipped, failed = 0, 0, 0
    # Bases whose tickets table has (or, on a real run, now has) the column and
    # can therefore be backfilled. On a dry run the column is not actually added,
    # so only bases that already had it are eligible: querying customer_id
    # anywhere else would fail with an unknown-column error and be miscounted as
    # a backfill failure.
    backfillable = []
    for project_uuid in project_uuids:
        try:
            outcome = add_column_to_base(project_uuid, args.dry_run)
        except Exception as e:
            failed += 1
            logger.error('%s: unexpected error: %s', project_uuid, e)
            continue
        if outcome == FAILED:
            failed += 1
            continue
        if outcome == ADDED:
            added += 1
            if not args.dry_run:
                backfillable.append(project_uuid)
        else:
            skipped += 1
            if outcome == ALREADY_PRESENT:
                backfillable.append(project_uuid)

    if args.backfill:
        if args.dry_run:
            logger.info(
                'Dry run: backfill is previewed for the %s base(s) that already have the column; '
                'bases getting the column in this run are backfilled when it is run for real',
                len(backfillable))
        total_filled, total_failed = 0, 0
        for project_uuid in backfillable:
            try:
                filled, backfill_failed = backfill_base(project_uuid, args.batch_size, args.dry_run)
                total_filled += filled
                total_failed += backfill_failed
            except Exception as e:
                total_failed += 1
                logger.error('%s: unexpected backfill error: %s', project_uuid, e)
        logger.info('Backfill total: %s ticket(s) filled, %s failed', total_filled, total_failed)
        failed += total_failed

    logger.info('Done: %s added, %s already present, %s failed', added, skipped, failed)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
