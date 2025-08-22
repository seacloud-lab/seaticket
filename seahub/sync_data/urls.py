from django.urls import re_path
from seahub.sync_data.views import github_webhook

urlpatterns = [
    re_path(r'webhook/github', github_webhook, name='github_webhook'),
]
