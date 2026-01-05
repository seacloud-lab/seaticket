from seahub.settings import *

# no cache for testing
# CACHES = {
#     'default': {
#         'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
#     }
# }

if 'REST_FRAMEWORK' not in globals():
    REST_FRAMEWORK = {}

if 'DEFAULT_THROTTLE_RATES' not in REST_FRAMEWORK:
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {}

# enlarge api throttle
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update({
    'ping': '90000/minute',
    'anon': '90000/minute',
    'user': '90000/minute',
    'share_link_zip_task': '90000/minute',
    'export': '90000/minute',
})
