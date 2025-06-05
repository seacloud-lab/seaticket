from django.conf import settings

# # work weixin base
ENABLE_ORG_WORK_WEIXIN = getattr(settings, 'ENABLE_ORG_WORK_WEIXIN', False)
ORG_WORK_WEIXIN_CORP_ID = getattr(settings, 'ORG_WORK_WEIXIN_CORP_ID', '')
ORG_WORK_WEIXIN_SUITE_ID = getattr(settings, 'ORG_WORK_WEIXIN_SUITE_ID', '')
ORG_WORK_WEIXIN_SECRET = getattr(settings, 'ORG_WORK_WEIXIN_SECRET', '')
ORG_WORK_WEIXIN_TOKEN = getattr(settings, 'ORG_WORK_WEIXIN_TOKEN', '')
ORG_WORK_WEIXIN_PROVIDER_SECRET = getattr(
    settings, 'ORG_WORK_WEIXIN_PROVIDER_SECRET', '')
ORG_WORK_WEIXIN_ENCODING_AES_KEY = getattr(
    settings,'ORG_WORK_WEIXIN_ENCODING_AES_KEY', '')
ORG_WORK_WEIXIN_OPEN_PACKAGE_ID = getattr(
    settings,'ORG_WORK_WEIXIN_OPEN_PACKAGE_ID', '')

ORG_WORK_WEIXIN_USER_INFO_AUTO_UPDATE = getattr(settings, 'ORG_WORK_WEIXIN_USER_INFO_AUTO_UPDATE', False)
ORG_WORK_WEIXIN_SUITE_ACCESS_TOKEN_URL = getattr(settings, 'ORG_WORK_WEIXIN_SUITE_ACCESS_TOKEN_URL',
                                                 'https://qyapi.weixin.qq.com/cgi-bin/service/get_suite_token')
ORG_WORK_WEIXIN_PRE_AUTH_CODE_URL = getattr(settings, 'ORG_WORK_WEIXIN_PRE_AUTH_CODE_URL',
                                            'https://qyapi.weixin.qq.com/cgi-bin/service/get_pre_auth_code')
ORG_WORK_WEIXIN_SET_SESSION_INFO_URL = getattr(settings, 'ORG_WORK_WEIXIN_SET_SESSION_INFO_URL',
                                               'https://qyapi.weixin.qq.com/cgi-bin/service/set_session_info')
ORG_WORK_WEIXIN_GET_PERMANENT_CODE_URL = getattr(settings, 'ORG_WORK_WEIXIN_SET_SESSION_INFO_URL',
                                                 'https://qyapi.weixin.qq.com/cgi-bin/service/get_permanent_code')
ORG_WORK_WEIXIN_CORP_ACCESS_TOKEN_URL = getattr(settings, 'ORG_WORK_WEIXIN_CORP_ACCESS_TOKEN_URL',
                                                'https://qyapi.weixin.qq.com/cgi-bin/service/get_corp_token')
ORG_WORK_WEIXIN_CORP_INSTALL_URL = getattr(settings, 'ORG_WORK_WEIXIN_CORP_INSTALL_URL',
                                           'https://open.work.weixin.qq.com/3rdapp/install')
ORG_WORK_WEIXIN_AUTHORIZATION_URL = getattr(settings, 'ORG_WORK_WEIXIN_AUTHORIZATION_URL',
                                            'https://open.work.weixin.qq.com/wwopen/sso/3rd_qrConnect')
ORG_WORK_WEIXIN_MOBILE_AUTHORIZATION_URL = getattr(settings, 'ORG_WORK_WEIXIN_MOBILE_AUTHORIZATION_URL',
                                                   'https://open.weixin.qq.com/connect/oauth2/authorize')
ORG_WORK_WEIXIN_GET_USER_INFO_URL = getattr(settings, 'ORG_WORK_WEIXIN_GET_USER_INFO_URL',
                                            'https://qyapi.weixin.qq.com/cgi-bin/service/get_login_info')
ORG_WORK_WEIXIN_GET_MOBILE_USER_INFO_URL = getattr(settings, 'ORG_WORK_WEIXIN_GET_MOBILE_USER_INFO_URL',
                                                   'https://qyapi.weixin.qq.com/cgi-bin/service/getuserinfo3rd')
ORG_WORK_WEIXIN_GET_MOBILE_USER_DETAIL_URL = getattr(settings, 'ORG_WORK_WEIXIN_GET_MOBILE_USER_DETAIL_URL',
                                                     'https://qyapi.weixin.qq.com/cgi-bin/service/getuserdetail3rd')
ORG_WORK_WEIXIN_PROVIDER_ACCESS_TOKEN_URL = getattr(settings, 'ORG_WORK_WEIXIN_PROVIDER_ACCESS_TOKEN_URL',
                                                    'https://qyapi.weixin.qq.com/cgi-bin/service/get_provider_token')
ORG_WORK_WEIXIN_CORP_INFO_URL = getattr(settings, 'ORG_WORK_WEIXIN_CORP_INFO_URL',
                                        ' https://qyapi.weixin.qq.com/cgi-bin/service/get_auth_info')
ORG_WORK_WEIXIN_CORP_JSAPI_TOKEN_URL = getattr(settings, 'ORG_WORK_WEIXIN_CORP_JSAPI_TOKEN_URL',
                                                    'https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket')
ORG_WORK_WEIXIN_AGENT_JSAPI_TOKEN_URL = getattr(settings, 'ORG_WORK_WEIXIN_AGENT_JSAPI_TOKEN_URL',
                                                    'https://qyapi.weixin.qq.com/cgi-bin/ticket/get')
ORG_WORK_WEIXIN_LIST_DEPARTMENT_MEMBERS_URL = getattr(settings, 'ORG_WORK_WEIXIN_LIST_DEPARTMENT_MEMBERS_URL',
                                                    'https://qyapi.weixin.qq.com/cgi-bin/user/simplelist')
ORG_WORK_WEIXIN_LIST_ACTIVED_ACCOUNT_URL = getattr(settings, 'ORG_WORK_WEIXIN_LIST_ACTIVED_ACCOUNT_URL',
                                                    'https://qyapi.weixin.qq.com/cgi-bin/license/list_actived_account')
ORG_WORK_WEIXIN_GET_ACTIVE_INFO_BY_USER_URL = getattr(settings, 'ORG_WORK_WEIXIN_GET_ACTIVE_INFO_BY_USER_URL',
                                                    'https://qyapi.weixin.qq.com/cgi-bin/license/get_active_info_by_user')
ORG_WORK_WEIXIN_GET_APP_LICENSE_INFO_URL = getattr(settings, 'ORG_WORK_WEIXIN_GET_APP_LICENSE_INFO_URL',
                                                    'https://qyapi.weixin.qq.com/cgi-bin/license/get_app_license_info')
ORG_WORK_WEIXIN_GET_REGISTER_CODE_URL = getattr(settings, 'ORG_WORK_WEIXIN_GET_REGISTER_CODE_URL',
                                                    'https://qyapi.weixin.qq.com/cgi-bin/service/get_register_code')
ORG_WORK_WEIXIN_REGISTER_URL = getattr(settings, 'ORG_WORK_WEIXIN_REGISTER_URL',
                                                    'https://open.work.weixin.qq.com/3rdservice/wework/register')

ORG_WORK_WEIXIN_AUTH_TYPE = getattr(settings, 'ORG_WORK_WEIXIN_AUTH_TYPE', 0)
ORG_WORK_WEIXIN_AUTH_SCOPE = getattr(
    settings, 'ORG_WORK_WEIXIN_AUTH_SCOPE', 'snsapi_privateinfo')

ORG_WORK_WEIXIN_PROVIDER = 'org-work-weixin'
REMEMBER_ME = True
SUCCESS_MSG = 'success'
