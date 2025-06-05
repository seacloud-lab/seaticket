# Copyright (c) 2012-2019 Seafile Ltd.
# encoding: utf-8
from django.conf import settings

# # weixin base
ENABLE_WEIXIN = getattr(settings, 'ENABLE_WEIXIN', False)
WEIXIN_APP_ID = getattr(settings, 'WEIXIN_APP_ID', '')
WEIXIN_APP_SECRET = getattr(settings, 'WEIXIN_APP_SECRET', '')
WEIXIN_ACCESS_TOKEN_URL = getattr(settings, 'WEIXIN_ACCESS_TOKEN_URL',
                                       'https://api.weixin.qq.com/sns/oauth2/access_token')

# # weixin oauth
WEIXIN_UID_PREFIX = WEIXIN_APP_ID + '_'
WEIXIN_USER_INFO_AUTO_UPDATE = getattr(settings, 'WEIXIN_USER_INFO_AUTO_UPDATE', False)
WEIXIN_AUTHORIZATION_URL = getattr(settings, 'WEIXIN_AUTHORIZATION_URL',
                                        'https://open.weixin.qq.com/connect/qrconnect')
WEIXIN_GET_USER_INFO_URL = getattr(settings, 'WEIXIN_GET_USER_INFO_URL',
                                        'https://api.weixin.qq.com/sns/userinfo')

# # mp weixin as Media Platform Weixin, oauth in mobile weixin client
MP_WEIXIN_APP_ID = getattr(settings, 'MP_WEIXIN_APP_ID', '')
MP_WEIXIN_APP_SECRET = getattr(settings, 'MP_WEIXIN_APP_SECRET', '')
MP_WEIXIN_AUTHORIZATION_URL = getattr(settings, 'MP_WEIXIN_AUTHORIZATION_URL',
                                        'https://open.weixin.qq.com/connect/oauth2/authorize')
MP_WEIXIN_ACCESS_TOKEN_URL = getattr(settings, 'MP_WEIXIN_ACCESS_TOKEN_URL',
                                        'https://api.weixin.qq.com/cgi-bin/token')
MP_WEIXIN_MESSAGE_TEMPLATE_ID = getattr(settings, 'MP_WEIXIN_MESSAGE_TEMPLATE_ID', '')
MP_WEIXIN_NOTIFICATIONS_URL = getattr(settings, 'MP_WEIXIN_NOTIFICATIONS_URL',
                                        'https://api.weixin.qq.com/cgi-bin/message/template/send')
MP_WEIXIN_USERS_OPENID_URL = getattr(settings, 'MP_WEIXIN_USERS_OPENID_URL',
                                        'https://api.weixin.qq.com/cgi-bin/user/get')

# # Miniprogram Weixin
MINIPROGRAM_WEIXN_APP_ID = getattr(settings, 'MINIPROGRAM_WEIXN_APP_ID', '')

# # Android Weixin
ANDROID_WEIXIN_APP_ID = getattr(settings, 'ANDROID_WEIXIN_APP_ID', '')
ANDROID_WEIXIN_APP_SECRET = getattr(settings, 'ANDROID_WEIXIN_APP_SECRET', '')

# # constants

WEIXIN_PROVIDER = 'weixin'
REMEMBER_ME = True
MP_OPENID = 'mp_openid'
