# -*- coding: utf-8 -*-
from django.urls import re_path

from .views import project_view
from .apis import ProjectConnectionsView, ProjectConnectionView, TicketsAPIView, TicketAPIView, \
    TicketRepliesAPIView, TicketReplyAPIView, ProjectRelatedUsersView


urlpatterns = [
    # project page
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/ask/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/search/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/ticket/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/ticket/new/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/ticket/(?P<ticket_number>\d+)/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/connection/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/$', project_view, name='project_view'),

    # user: related users
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/related-users/$', ProjectRelatedUsersView.as_view(), name='api-v2.1-project-related-users'),

    # connections
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/$', ProjectConnectionsView.as_view(), name='api-v2.1-connections'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/$', ProjectConnectionView.as_view(), name='api-v2.1-connection'),

    # ticket
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/$', TicketsAPIView.as_view(), name='api-v2.1-project-tickets'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_number>\d+)/$', TicketAPIView.as_view(), name='api-v2.1-project-ticket'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_number>\d+)/replies/$', TicketRepliesAPIView.as_view(), name='api-v2.1-project-ticket-replies'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_number>\d+)/replies/(?P<reply_number>\d+)/$', TicketReplyAPIView.as_view(), name='api-v2.1-project-ticket-reply'),

]

