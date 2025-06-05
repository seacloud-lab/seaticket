import seahub.settings as settings

ENABLE_DINGTALK = getattr(settings, 'ENABLE_DINGTALK', False)
DINGTALK_AGENT_ID = getattr(settings, 'DINGTALK_AGENT_ID', '')
DINGTALK_APP_KEY = getattr(settings, 'DINGTALK_APP_KEY', '')
DINGTALK_APP_SECRET = getattr(settings, 'DINGTALK_APP_SECRET', '')
DINGTALK_UID_PREFIX = DINGTALK_AGENT_ID + '_'

# for dingtalk auth login
DINGTALK_AUTH_LOGIN_REMEMBER_ME = True
DINGTALK_AUTH_RESPONSE_TYPE = getattr(settings, 'DINGTALK_AUTH_RESPONSE_TYPE', 'code')
DINGTALK_AUTH_SCOPE = getattr(settings, 'DINGTALK_AUTH_SCOPE', 'openid')
DINGTALK_AUTH_PROMPT = getattr(settings, 'DINGTALK_AUTH_PROMPT', 'consent')
DINGTALK_AUTH_URL = getattr(settings, 'DINGTALK_AUTH_URL', 'https://login.dingtalk.com/oauth2/auth')
DINGTALK_AUTH_TOKEN_GRANT_TYPE = getattr(settings, 'DINGTALK_AUTH_TOKEN_GRANT_TYPE', 'authorization_code')

DINGTALK_USER_ACCESS_TOKEN_URL = getattr(settings, 'DINGTALK_USER_ACCESS_TOKEN_URL', 'https://api.dingtalk.com/v1.0/oauth2/userAccessToken')
DINGTALK_GET_USER_INFO_URL = getattr(settings, 'DINGTALK_GET_USER_INFO_URL', 'https://api.dingtalk.com/v1.0/contact/users/')
DINGTALK_GET_DETAILED_USER_INFO_URL = getattr(settings, 'DINGTALK_GET_DETAILED_USER_INFO_URL', 'https://oapi.dingtalk.com/topapi/v2/user/get')
DINGTALK_GET_USERID_BY_UNIONID_URL = getattr(settings, 'DINGTALK_GET_USERID_BY_UNIONID_URL', 'https://oapi.dingtalk.com/topapi/user/getbyunionid')

DINGTALK_OAUTH_CREATE_UNKNOWN_USER = getattr(settings, 'DINGTALK_OAUTH_CREATE_UNKNOWN_USER', True)
DINGTALK_OAUTH_ACTIVATE_USER_AFTER_CREATION = getattr(settings, 'DINGTALK_OAUTH_ACTIVATE_USER_AFTER_CREATION', True)

DINGTALK_GET_APP_ACCESS_TOKEN_URL = getattr(settings, 'DINGTALK_GET_APP_ACCESS_TOKEN_URL', 'https://oapi.dingtalk.com/gettoken')

# for dingtalk message
DINGTALK_MESSAGE_SEND_TO_CONVERSATION_URL = getattr(settings, 'DINGTALK_MESSAGE_SEND_TO_CONVERSATION_URL', 'https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2')

# cache key
DINGTALK_ACCESS_TOKEN_CACHE_KEY = 'DINGTALK_ACCESS_TOKEN'
DINGTALK_UNION_CACHE_PREFIX = 'DINGTALK_UNION_ID_'

# constants
DINGTALK_PROVIDER = 'dingtalk'
