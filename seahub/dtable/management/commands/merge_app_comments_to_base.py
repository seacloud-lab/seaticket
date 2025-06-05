# encoding: utf-8
import logging
from datetime import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone

from seahub.dtable.models import COMMENT_FROM_UNIVERSAL_APP, DTableRowComments
from seahub.dtable_apps.universal_app.models import DTableAppRowComments
from seahub.utils import uuid_str_to_32_chars

logger = logging.getLogger(__name__)


def local_to_utc(datetime_obj):
    current_timezone = timezone.get_current_timezone()
    dt_obj_in_current_tz = datetime_obj.replace(tzinfo=current_timezone)
    utc_time = dt_obj_in_current_tz.astimezone(timezone.utc)
    naive_utc = utc_time.replace(tzinfo=None)
    return naive_utc


class Command(BaseCommand):
    help = 'copy comments from universal app into bases'
    label = 'merge_app_comments_to_base'

    def handle(self, *args, **options):
        logger.debug('Start merging app comments')
        self.stdout.write('[%s] Start merging app comments...\n' % datetime.now())
        self.do_action(*args, **options)
        self.stdout.write('[%s] Finish merging app comments\n' % datetime.now())
        logger.debug('Finish copying dtable')

    def local_to_utc(self, datetime_obj):
        current_timezone = timezone.get_current_timezone()
        dt_obj_in_current_tz = datetime_obj.replace(tzinfo=current_timezone)
        utc_time = dt_obj_in_current_tz.astimezone(timezone.utc)
        naive_utc = utc_time.replace(tzinfo=None)
        return naive_utc

    def do_action(self, *args, **options):
        offset, limit = 0, 1000
        total_count = 0
        while True:
            try:
                self.log_info(f'start to merge offset: {offset} limit: {limit}')
                app_comments = list(DTableAppRowComments.objects.all()[offset: limit])
                base_comments = []
                for item in app_comments:
                    author = item.author
                    comment = item.comment
                    created_at = local_to_utc(item.created_at)
                    dtable_uuid = uuid_str_to_32_chars(item.dtable_uuid)
                    row_id = item.row_id
                    resolved = item.resolved
                    comment_from  = COMMENT_FROM_UNIVERSAL_APP
                    base_comments.append(
                        DTableRowComments(
                            author = author,
                            comment = comment,
                            created_at = created_at,
                            updated_at = datetime.utcnow(),
                            dtable_uuid = dtable_uuid,
                            row_id = row_id,
                            resolved = resolved,
                            comment_from = comment_from
                        )
                    )
                try:
                    DTableRowComments.objects.bulk_create(base_comments)
                except Exception as e:
                    logger.exception(e)
                    self.log_error(f'merge offset: {offset} limit: {limit} len: {len(base_comments)} merge error: {e}')
                else:
                    total_count += len(base_comments)
                if len(app_comments) < limit:
                    break
                offset += limit
            except Exception as e:
                logger.exception(e)
                self.log_error(f'query or merge error: {e}')
                break

        self.log_info(f'totally merge {total_count} comments')

    def log_debug(self, msg):
        logger.debug(msg)
        self.print_log(msg)

    def log_info(self, msg):
        logger.info(msg)
        self.print_log(msg)

    def log_error(self, msg):
        logger.error(msg)
        self.print_log(msg)

    def print_log(self, msg):
        self.stdout.write('[%s] %s\n' % (str(datetime.now()), msg))
