from seahub.settings import *

# no cache for testing
# CACHES = {
#     'default': {
#         'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
#     }
# }


REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'ping': '90000/minute',
        'anon': '90000/minute',
        'user': '90000/minute',
        'app': '90000/minute',
        'export': '90000/minute',
        'import': '90000/minute',
    },
}
