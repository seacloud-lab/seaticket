# -*- coding: utf-8 -*-
from django.conf import settings

TSH_AUTH_APP_ID = getattr(settings, 'TSH_AUTH_APP_ID', '')
TSH_AUTH_APP_ID_MD5 = getattr(settings, 'TSH_AUTH_APP_ID_MD5', '')
TSH_AUTH_SEQ = getattr(settings, 'TSH_AUTH_SEQ', '')

TSINGHUA_AUTH_ACTIVATE_USER_AFTER_CREATION = getattr(settings, 'TSINGHUA_AUTH_ACTIVATE_USER_AFTER_CREATION', False)
TSH_AUTH_USERNAME_SUFFIX = getattr(settings, 'TSH_AUTH_USERNAME_SUFFIX', '@tsinghua.edu.cn')

TSH_AUTH_REDIRECT_URI = getattr(
    settings, 'TSH_AUTH_REDIRECT_URI',
    'https://id.tsinghua.edu.cn/do/off/ui/auth/login/form/{AppIDMD5}/{seq}')
TSH_AUTH_TICKET_CHECK_URI = getattr(
    settings, 'TSH_AUTH_TICKET_CHECK_URI',
    'https://id.tsinghua.edu.cn/thuser/authapi/checkticket/{AppID}/{ticket}/{ip}'
)
