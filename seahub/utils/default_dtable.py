import base64
import json
import uuid
from datetime import datetime

from django.conf import settings

from seahub.profile.models import Profile

DEFAULT_DTABLE_FORMAT_VERSION = getattr(settings, 'DEFAULT_DTABLE_FORMAT_VERSION', 9)


class DefaultDTable:

    def __init__(self, username):
        self.username = username
        self.language = None

    def generate(self):
        if not self.language:
            self.language = Profile.objects.get_user_language(self.username) or 'en'

        self.data = {
            'format_version': DEFAULT_DTABLE_FORMAT_VERSION,
            'version': 1,
            'tables': [
                {
                    '_id': '0000',
                    'name': 'Table1',
                    'columns':  [
                        {
                            'key': '0000',
                            'name': self.get_column_default_name(),
                            'type': 'text',
                            'width': 200,
                            'editable': True,
                            'resizable': True
                        }
                    ],
                    'rows':  [
                        self.gen_new_row(),
                        self.gen_new_row(),
                        self.gen_new_row()
                    ],
                    'view_structure': {
                    'folders': [],
                    'view_ids': [ '0000' ]
                    },
                    'views': [
                        {
                            '_id': '0000',
                            'name': self.get_view_default_name(),
                            'type': 'table',
                            'is_locked': False,
                            'rows': [],
                            'formula_rows': [],
                            'summaries': [],
                            'filter_conjunction': 'And',
                            'filters': [],
                            'sorts': [],
                            'hidden_columns': [],
                            'groupbys': [],
                            'groups': [],
                        }
                    ],
                    'id_row_map': [],
                }
            ]
        }
        return json.dumps(self.data)

    def gen_new_row(self):
        now = self.get_now()
        new_row = {
            '_id': self.gen_row_id(),
            '_participants': [],
            '_creator': self.username,
            '_ctime': now,
            '_last_modifier': self.username,
            '_mtime': now
        }
        return new_row
    
    def gen_row_id(self):
        ''' slugid.nice()
        '''
        rawBytes = bytearray(uuid.uuid4().bytes)
        rawBytes[0] = rawBytes[0] & 0x7f  # Ensure slug starts with [A-Za-f]
        slug = base64.urlsafe_b64encode(rawBytes)[:-2]
        if isinstance(slug, bytes):
            slug = slug.decode('utf-8')
        return slug

    def get_now(self):
        now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + '+00:00'
        return now
    
    def get_view_default_name(self):
        return 'Default View' if self.language != 'zh-cn' else '默认视图'

    def get_column_default_name(self):
        return 'Name' if self.language != 'zh-cn' else '名称'
