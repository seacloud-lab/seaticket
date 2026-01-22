import os
import base64
import logging
from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import models


logger = logging.getLogger(__name__)
AVATAR_DIR_PREFIX = '/shared/seaqa-web-data/'


class AvatarUploaded(models.Model):
    filename = models.TextField()
    filename_md5 = models.CharField(max_length=32, primary_key=True)
    data = models.TextField()
    size = models.IntegerField()
    mtime = models.DateTimeField()

    class Meta:
        db_table = 'avatar_uploaded'


class Command(BaseCommand):
    help = "Migrate avatars from database to file system."

    def println(self, msg):
        self.stdout.write('[%s] %s\n' % (str(datetime.now()), msg))

    def log_error(self, msg):
        logger.error(msg)
        self.println(msg)

    def log_info(self, msg):
        logger.info(msg)
        self.println(msg)

    def log_debug(self, msg):
        logger.debug(msg)
        self.println(msg)

    def get_fs_absolute_path(self, filename):
        return AVATAR_DIR_PREFIX + filename

    def create_fs_dir(self, fs_absolute_path):
        dir_name = os.path.dirname(fs_absolute_path)
        os.makedirs(dir_name, exist_ok=True)
        return dir_name

    def check_avatar_exists(self, fs_absolute_path):
        if os.path.exists(fs_absolute_path) \
                and os.path.getsize(fs_absolute_path) > 0:
            return True
        return False

    def handle(self, **options):
        success_count = 0
        error_count = 0

        rows_count = AvatarUploaded.objects.count()
        self.log_info('Start migrate avatar to file system, total: %d' % (rows_count))

        for i in range(0, rows_count + 100, 100):
            time_start = datetime.now()
            items = AvatarUploaded.objects.all()[i: i + 100]
            self.log_info('Start parse: %d ~ %d, count: %d' % (i, i + 99, items.count()))

            for item in items:
                try:
                    self._save(item)
                    success_count += 1
                except Exception as e:
                    logger.exception(e)
                    self.log_error('ERROR: %s, %s' % (item.filename_md5, e))
                    error_count += 1

            time_end = datetime.now()
            self.log_info('Cost: %s' % (str(time_end - time_start)))

        self.log_info('Avatar Migrated to file system success: %d, error: %d' % (success_count, error_count))

    def _save(self, item):
        # save to file system
        fs_absolute_path = self.get_fs_absolute_path(item.filename)
        fs_dir = self.create_fs_dir(fs_absolute_path)
        exists = self.check_avatar_exists(fs_absolute_path)
        if exists:
            return

        avatar_data = base64.b64decode(item.data)

        with open(fs_absolute_path, 'wb') as f:
            f.write(avatar_data)
