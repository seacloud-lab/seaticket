# -*- coding: utf-8 -*-
from django.urls import re_path

from .views import project_view
from .apis import ProjectConnectionsView, ProjectConnectionView, TicketsAPIView, TicketAPIView, \
    TicketRepliesAPIView, TicketReplyAPIView, ProjectRelatedUsersView, ProjectTagsAPIView, ProjectTagAPIView, \
    ProjectUploadFileAPIView, GetProjectUploadFileView, ProjectFileAPIView, GetProjectFileView, \
    ListGitHubIssuesRecordView

urlpatterns = [
    # project page
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/ask/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/search/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/tags/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/new/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/(?P<ticket_number>\d+)/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/connections/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/$', project_view, name='project_view'),

    # user: related users
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/related-users/$', ProjectRelatedUsersView.as_view(), name='api-v2.1-project-related-users'),

    # connections
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/$', ProjectConnectionsView.as_view(), name='api-v2.1-connections'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/$', ProjectConnectionView.as_view(), name='api-v2.1-connection'),

    # connection details
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/issues-records/$', ListGitHubIssuesRecordView.as_view(), name='api-v2.1-github-issues-record'),

    # ticket
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/$', TicketsAPIView.as_view(), name='api-v2.1-project-tickets'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_number>\d+)/$', TicketAPIView.as_view(), name='api-v2.1-project-ticket'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_number>\d+)/replies/$', TicketRepliesAPIView.as_view(), name='api-v2.1-project-ticket-replies'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_number>\d+)/replies/(?P<reply_number>\d+)/$', TicketReplyAPIView.as_view(), name='api-v2.1-project-ticket-reply'),

    # tags
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tags/$', ProjectTagsAPIView.as_view(), name='api-v2.1-project-tags'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tags/(?P<tag_id>\d+)/$', ProjectTagAPIView.as_view(), name='api-v2.1-project-tag'),

    # files
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/upload-file/$', ProjectUploadFileAPIView.as_view(), name='api-v2.1-project-upload-file'),
    re_path(r'^upload-file/project/(?P<project_uuid>[-0-9a-f]+)/(?P<file_path>.*)$', GetProjectUploadFileView.as_view(), name='api-v2.1-get-project-upload-file'),

    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/(?P<file_path>.*)$', ProjectFileAPIView.as_view(), name='api-v2.1-project-file'),
    re_path(r'^file/project/(?P<project_uuid>[-0-9a-f]+)/(?P<file_path>.*)$', GetProjectFileView.as_view(), name='api-v2.1-get-project-file'),

]

