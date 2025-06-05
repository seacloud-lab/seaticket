from django.conf import settings

# # org dingtalk
ENABLE_ORG_DINGTALK = getattr(settings, 'ENABLE_ORG_DINGTALK', False)
ORG_DINGTALK_SUITE_KEY = getattr(settings, 'ORG_DINGTALK_SUITE_KEY', '')
ORG_DINGTALK_SUITE_SECRET = getattr(settings, 'ORG_DINGTALK_SUITE_SECRET', '')

ORG_DINGTALK_TOKEN = getattr(settings, 'ORG_DINGTALK_TOKEN', '')
ORG_DINGTALK_ENCODING_AES_KEY = getattr(settings, 'ORG_DINGTALK_ENCODING_AES_KEY', '')

ORG_DINGTALK_USER_INFO_AUTO_UPDATE = getattr(settings, 'ORG_DINGTALK_USER_INFO_AUTO_UPDATE', False)
ORG_DINGTALK_SUITE_ACCESS_TOKEN_URL = getattr(settings, 'ORG_DINGTALK_SUITE_ACCESS_TOKEN_URL',
                                                 'https://api.dingtalk.com/v1.0/oauth2/suiteAccessToken')
ORG_DINGTALK_AUTH_INFO_URL = getattr(settings, 'ORG_DINGTALK_PREMANENT_CODE_URL',
                                            'https://api.dingtalk.com/v1.0/oauth2/apps/authInfo')

ORG_DINGTALK_AUTHORIZATION_URL = getattr(settings, 'ORG_DINGTALK_AUTHORIZATION_URL',
                                            'https://login.dingtalk.com/oauth2/auth')
ORG_DINGTALK_USER_ACCESS_TOKEN_URL = getattr(settings, 'ORG_DINGTALK_USER_ACCESS_TOKEN_URL',
                                                   'https://api.dingtalk.com/v1.0/oauth2/userAccessToken')
ORG_DINGTALK_GET_USER_INFO_URL = getattr(settings, 'ORG_DINGTALK_GET_USER_INFO_URL',
                                            'https://api.dingtalk.com/v1.0/contact/users/')

# # notifications
DINGTALK_NOTIFICATIONS_URL = getattr(settings, 'DINGTALK_NOTIFICATIONS_URL',
                                        'https://oapi.dingtalk.com/topapi/message/corpconversation/sendbytemplate')
ORG_DINGTALK_GET_CORP_ACCESS_TOKEN_URL = getattr(settings, 'ORG_DINGTALK_CORP_ACCESS_TOKEN_URL',
                                                'https://api.dingtalk.com/v1.0/oauth2/corpAccessToken')
ORG_DINGTALK_MESSAGE_TEMPLATE_ID = getattr(settings, 'ORG_DINGTALK_MESSAGE_TEMPLATE_ID', '')

# # logon free
ORG_DINGTALK_LOGON_FREE_GET_CORP_ACCESS_TOKEN_URL = getattr(settings, 'ORG_DINGTALK_LOGON_FREE_GET_CORP_ACCESS_TOKEN_URL',
                                                 'https://oapi.dingtalk.com/service/get_corp_token')
ORG_DINGTALK_LOGON_FREE_GET_USER_INFO_URL = getattr(settings, 'ORG_DINGTALK_LOGON_FREE_GET_USER_INFO_URL',
                                            'https://oapi.dingtalk.com/topapi/v2/user/getuserinfo')
ORG_DINGTALK_LOGON_FREE_GET_USER_URL = getattr(settings, 'ORG_DINGTALK_LOGON_FREE_GET_USER_URL',
                                            'https://oapi.dingtalk.com/topapi/v2/user/get')
ORG_DINGTALK_UNIONID_TO_USERID_URL = getattr(settings, 'ORG_DINGTALK_UNIONID_TO_USERID_URL',
                                                'https://oapi.dingtalk.com/topapi/user/getbyunionid')

ORG_DINGTALK_PROVIDER = 'org-dingtalk'
REMEMBER_ME = True
