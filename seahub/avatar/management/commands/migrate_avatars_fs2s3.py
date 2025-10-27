import io
import os
import sys
import time
import logging
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.files import File
from django_s3_storage.storage import S3Storage

from seahub.avatar.models import Avatar


logger = logging.getLogger(__name__)
success_path = '/shared/seasearch/logs/avatar_upload_success.log'


class Command(BaseCommand):
    help = "Migrate avatars from file system to S3."

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

    def handle(self, **options):
        s3_kwargs = {}
        if getattr(settings, 'S3_ENDPOINT_URL', ''):
            s3_kwargs['AWS_S3_ENDPOINT_URL'.lower()] = settings.S3_ENDPOINT_URL
        if getattr(settings, 'S3_REGION', ''):
            s3_kwargs['AWS_REGION'.lower()] = settings.S3_REGION
        if getattr(settings, 'S3_ACCESS_KEY_ID', ''):
            s3_kwargs['AWS_ACCESS_KEY_ID'.lower()] = settings.S3_ACCESS_KEY_ID
        if getattr(settings, 'S3_SECRET_ACCESS_KEY', ''):
            s3_kwargs['AWS_SECRET_ACCESS_KEY'.lower()] = settings.S3_SECRET_ACCESS_KEY
        if getattr(settings, 'S3_BUCKET_NAME', ''):
            s3_kwargs['AWS_S3_BUCKET_NAME'.lower()] = settings.S3_BUCKET_NAME
        self.storage = S3Storage(**s3_kwargs)

        start_id = 1
        rows_count = 1000000
        offset = 10000
        self.log_info('Start migrate avatar to S3\n')

        success_set = self.read_success_set()
        success_file = open(success_path, mode='a', encoding='utf-8')

        for i in range(start_id, rows_count, offset):
            success_count = 0
            error_count = 0
            exists_count = 0

            avatar_queryset = self.query_avatar(i, i + offset)
            queryset_count = avatar_queryset.count()
            if not avatar_queryset:
                self.log_info('Migrate done\n')
                break

            self.log_info(
                'Start parse id: %s ~ %s\n' % (i, i + offset - 1))
            for avatar in avatar_queryset:
                try:
                    # main
                    avatar_id = avatar.id
                    if str(avatar_id) in success_set:
                        # exist
                        exists_count += 1
                        continue

                    avatar_file = self.get_avatar_file(avatar_id, avatar.avatar)
                    if not avatar_file:
                        # not found
                        error_count += 1
                        continue

                    # save
                    self._save(avatar_id, avatar_file, avatar.avatar.name)
                    success_count += 1
                    self.record_success(success_file, avatar_id, success_count) 
                except Exception as e:
                    error_count += 1
                    logger.exception(e)
                    self.log_error('ERROR: %s, %s\n' % (avatar_id, e))

            self.log_info(
                'Success: %s, exists: %s, error: %s, count: %s\n' % (success_count, exists_count, error_count, queryset_count))

        # close
        success_file.close()

    def record_success(self, success_file, avatar_id, success_count):
        success_file.write(str(avatar_id) + '\n')
        if success_count % 100 == 0:
            success_file.flush()
            self.log_info('Flush record\n')

    def read_success_set(self):
        if not os.path.exists(success_path):
            return set()
        s = time.time()

        with open(success_path, mode='r', encoding='utf-8') as f:
            content = f.readlines()
        count = len(content)
        success_set = {m.rstrip('\n') for m in content}
        memory_size = sys.getsizeof(success_set)

        e = time.time()
        self.log_info(
            'Read success_id count: %s, memory size: %s, cost: %s\n' % (count, memory_size, round((e - s), 2)))
        return success_set

    def query_avatar(self, start_id, end_id):
        # list avatars
        s = time.time()

        # BETWEEN sql operation
        avatar_queryset = Avatar.objects.filter(id__range=(start_id, end_id))
        count = avatar_queryset.count()
        memory_size = sys.getsizeof(avatar_queryset)

        e = time.time()
        self.log_info(
            'Query db count: %s, memory size: %s, cost: %s\n' % (count, memory_size, round((e - s), 2)))
        return avatar_queryset

    def get_avatar_file(self, avatar_id, avatar_path):
        # get avatar file from file system
        s = time.time()

        try:
            avatar_file = avatar_path.read()
        except:
            self.log_error('NOT FOUND: %s\n' % avatar_id)
            avatar_file = None

        e = time.time()
        self.log_info(
            '(%s) get avatar file cost: %s' % (avatar_id, round((e - s), 2)))
        return avatar_file

    def _save(self, avatar_id, avatar_file, avatar_name):
        # save to S3
        s = time.time()
        filename = avatar_name

        file = File(io.BytesIO(avatar_file))
        s3_path = self.storage.save(name=filename, content=file)

        e = time.time()
        self.log_info(
            '(%s) upload avatar   cost: %s' % (avatar_id, round((e - s), 2)))
        return s3_path

    def is_exists(self, filename):
        # exists in S3
        return self.storage.exists(filename)
