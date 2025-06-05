# encoding: utf-8
import logging
from datetime import datetime
from django.core.management.base import BaseCommand

from seahub.dtable.models import DTables
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.settings import INNER_DTABLE_DB_URL
from seahub.utils import get_inner_dtable_server_url
import time
logger = logging.getLogger(__name__)

ROW_LIMIT = 200

def handle_file_cell_datas(cell_datas, old_domain, new_domain):
    for data in cell_datas:
        data['url'] = data['url'].replace(old_domain, new_domain)
    return cell_datas

def handle_img_cell_datas(cell_datas, old_domain, new_domain):
    new_cell_datas = []
    for url in cell_datas:
        new_url = url.replace(old_domain, new_domain)
        new_cell_datas.append(new_url)
    return new_cell_datas

def handle_longtext_cell_datas(cell_datas, old_domain, new_domain):
    return cell_datas.replace(old_domain, new_domain)

def get_asset_columns(api, table_name):
    columns = api.list_columns(table_name)
    column_details = {
        'file_cols': [],
        'img_cols': [],
        'longtext_cols': [],
    }
    
    for col in columns:
        if col.get('type') == 'file':
            column_details['file_cols'].append(col.get('name'))
        elif col.get('type') == 'image':
            column_details['img_cols'].append(col.get('name'))
        elif col.get('type') == 'long-text':
            column_details['longtext_cols'].append(col.get('name'))


    return column_details

def get_rows(api, table_name, start, limit):
    sql = "select * from `%s` limit %s, %s" % (
        table_name,
        start,
        limit,
    )

    resp = api.query(sql, convert=True)
    return resp['results']


def format_updates(rows, column_details, old_domain, new_domain):
    updates = []
    file_col_names = column_details.get('file_cols')
    img_col_names = column_details.get('img_cols')
    longtext_col_names = column_details.get('longtext_cols')
    for row in rows:
        row_id = row.get('_id')
        row_data = {
            'row_id': row_id,
            'row': {}
        }
        if file_col_names:
            for fname in file_col_names:
                cell_value = row.get(fname)
                if cell_value:
                    row_data['row'][fname] = handle_file_cell_datas(cell_value, old_domain, new_domain)
        if img_col_names:
            for iname in img_col_names:
                cell_value = row.get(iname)
                if cell_value:
                    row_data['row'][iname] = handle_img_cell_datas(cell_value, old_domain, new_domain)
        if longtext_col_names:
            for lname in longtext_col_names:
                cell_value = row.get(lname)
                if cell_value:
                    row_data['row'][lname] = handle_longtext_cell_datas(cell_value, old_domain, new_domain)

        if row_data['row']:
            updates.append(row_data)

    return updates

class Command(BaseCommand):
    help = 'transfer the domain in file or image column of a base'
    label = "domain_transfer"

    def print_msg(self, msg):
        self.stdout.write('[%s] %s\n' % (datetime.now(), msg))

    def add_arguments(self, parser):
        parser.add_argument('-all', help='transfer all bases', action='store_true')
        parser.add_argument('-uuid', type=str, help='uuid of dtable')
        parser.add_argument('-od', type=str, help='old domain')
        parser.add_argument('-nd', type=str, help='new domain')


    def handle(self, *args, **options):
        logger.debug('Start handling domains')
        self.print_msg('Start handling domains')
        self.do_action(*args, **options)
        logger.debug('Finish handling domains')
        self.print_msg('Finish handling domains')


    def handle_domain_for_all_bases(self, old_domain, new_domain):
        dtables = DTables.objects.filter(deleted=False).all()
        for dtable in dtables:
            dtable_name = dtable.name
            dtable_uuid = str(dtable.uuid)
            logger.debug('Handling base %s[%s]' % (dtable_name, dtable_uuid))
            self.print_msg('Handling base %s[%s]' % (dtable_name, dtable_uuid))
            try:
                self.handle_domain(dtable_uuid, old_domain, new_domain)
                time.sleep(0.2)
            except Exception as err:
                logger.debug('Handling base %s[%s], error: %s' % (dtable_name, dtable_uuid, err))
                self.print_msg('Handling base %s[%s], error: %s' % (dtable_name, dtable_uuid, err))
                continue

    def handle_domain(self, dtable_uuid, old_domain, new_domain):
        dtable_server_url = get_inner_dtable_server_url()
        server_api = DTableServerAPI('admin', dtable_uuid, dtable_server_url)
        db_api = DTableDBAPI('admin', dtable_uuid, INNER_DTABLE_DB_URL)
        tables = server_api.get_metadata()['tables']
        for table in tables:
            table_name = table.get('name')
            logger.debug('Transfering domain in Table %s' % table_name)
            self.print_msg('Transfering domain in Table %s' % table_name)
            column_details = get_asset_columns(server_api, table_name)
            if not (column_details['file_cols'] or column_details['img_cols'] or column_details['longtext_cols']):
                continue
            try:
                start = 0
                limit = ROW_LIMIT
                while True:
                    rows = get_rows(db_api, table_name, start, limit)                
                    updates = format_updates(rows, column_details, old_domain, new_domain)
                    db_api.batch_update_rows(table_name, updates)
                    if len(rows) < ROW_LIMIT:
                        break
                    start += limit
            except Exception as err:
                logger.debug('Transfering domain in Table %s Failed, error: %s' % (table_name, err))
                self.print_msg('Transfering domain in Table %s Failed, error: %s' % (table_name, err))
                continue

            logger.debug('Successfully transfered domain in Table %s' % (table_name))
            self.print_msg('Successfully transfered domain in Table %s' % (table_name))

    def do_action(self, *args, **options):
        all_option = options['all']
        old_domain = options['od']
        new_domain = options['nd']
        dtable_uuid = options['uuid']
        if all_option:
            if not (old_domain or new_domain):
                logger.debug(
                    'Please use < -all | -od [old_domain] | -nd [new_domain] >')
                self.stdout.write(
                    '\nPlease use < -all | -od [old_domain] | -nd [new_domain]')
                return

            self.handle_domain_for_all_bases(
                old_domain.rstrip('/'),
                new_domain.rstrip('/')
            )
        else:
            if not (dtable_uuid or old_domain or new_domain):
                logger.debug(
                    'Please use < -uuid [dtable_uuid] | -od [old_domain] | -nd [new_domain] >')
                self.stdout.write(
                    '\nPlease use < -uuid [dtable_uuid] | -od [old_domain] | -nd [new_domain]')
                return
            self.handle_domain(
                dtable_uuid,
                old_domain.rstrip('/'),
                new_domain.rstrip('/')
            )

