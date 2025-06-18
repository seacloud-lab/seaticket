# -*- coding: utf-8 -*-
from django.urls import re_path

from .views import project_view

urlpatterns = [
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<name>.*)/$', project_view, name='project_view'),
]
