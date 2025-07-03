# -*- coding: utf-8 -*-
from django.urls import re_path

from .views import project_view, ProjectConnectionsView, ProjectConnectionView
from .constants import ConnectionType

urlpatterns = [
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/$', project_view, name='project_view'),

    # connections
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/connections/(?P<connection_type>{})/$'.format(ConnectionType.get_pattern()), ProjectConnectionsView.as_view(), name='api-v2.1-connections'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/connections/(?P<connection_type>{})/(?P<connection_id>\d+)/$'.format(ConnectionType.get_pattern()), ProjectConnectionView.as_view(), name='api-v2.1-connection'),
]
