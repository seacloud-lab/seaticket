# -*- coding: utf-8 -*-
from django.urls import re_path

from .views import project_view
from .apis import ProjectConnectionsView, ProjectConnectionView


urlpatterns = [
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/$', project_view, name='project_view'),

    # connections
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/project/(?P<project_uuid>[-0-9a-f]{36})/connections/$', ProjectConnectionsView.as_view(), name='api-v2.1-connections'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/$', ProjectConnectionView.as_view(), name='api-v2.1-connection'),
]

