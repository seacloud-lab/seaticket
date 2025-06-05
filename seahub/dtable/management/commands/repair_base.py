import logging

from django.utils import timezone 
from django.core.management.base import BaseCommand

from seahub.dtable.models import DTables
from seahub.dtable.utils import get_inner_dtable_server_url, uuid_str_to_36_chars
from seahub.dtable_apps.dtable_server_api import DTableServerAPI

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Repair a base'

    def add_arguments(self, parser):
        # Positional arguments
        parser.add_argument('dtable_uuid', type=str, help='dtable uuid')

    def handle(self, *args, **options):
        dtable_uuid = options['dtable_uuid']
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            self.stderr.write('[%s] dtable: %s not found' % (timezone.now(), dtable_uuid))
            return
        dtable_server_url = get_inner_dtable_server_url()
        dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, dtable_server_url)
        try:
            dtable_server_api.repair_base()
        except Exception as e:
            self.stderr.write('[%s] repire base: %s error: %s' % (timezone.now(), dtable_uuid, e))
            return
        self.stdout.write('[%s] repire base: %s done' % (timezone.now(), dtable_uuid))
