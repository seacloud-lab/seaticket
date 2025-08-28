# -*- coding: utf-8 -*-
from django.urls import re_path

from .views import project_view

from .apis import ProjectRelatedUsersView
from .connections import ProjectConnectionsView, ProjectConnectionView, ProjectConnectionSyncView, \
    ProjectConnectionDetailsView, GithubWebhookView, ProjectConnectionRowDetailView
from .files import ProjectUploadFileAPIView, GetProjectUploadFileView, \
    ProjectFileAPIView, GetProjectFileView
from .ticket_tags import ProjectTagsAPIView, ProjectTagAPIView, ProjectTagTicketsAPIView
from .ticket_types import ProjectTypesAPIView, ProjectTypeAPIView, ProjectTypeTicketsAPIView
from .tickets import TicketsAPIView, TicketAPIView, TicketRepliesAPIView, TicketReplyAPIView
from .ticket_views import TicketFolders, TicketViewsAPI, TicketViewView, \
    TicketViewsMoveView, TicketViewsDuplicateView


urlpatterns = [
    # project page
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/ask/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/ask/(?P<children_id>[-0-9a-f]{36})/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/search/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/tags/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/tags/(?P<children_id>\d+)/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/new/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/(?P<children_id>\d+)/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/connections/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/connections/(?P<children_id>\d+)/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/$', project_view, name='project_view'),

    # user: related users
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/related-users/$', ProjectRelatedUsersView.as_view(), name='api-v2.1-project-related-users'),

    #sync data
    re_path(r'webhook/github', GithubWebhookView.as_view(), name='github_webhook'),

    # connections
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/$', ProjectConnectionsView.as_view(), name='api-v2.1-connections'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/$', ProjectConnectionView.as_view(), name='api-v2.1-connection'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/sync/$', ProjectConnectionSyncView.as_view(), name='api-v2.1-connection-sync'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/details/$', ProjectConnectionDetailsView.as_view(), name='api-v2.1-connection-details'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/details/row-detail/$', ProjectConnectionRowDetailView.as_view(), name='api-v2.1-connection-row-detail'),

    # ticket
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/$', TicketsAPIView.as_view(), name='api-v2.1-project-tickets'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_number>\d+)/$', TicketAPIView.as_view(), name='api-v2.1-project-ticket'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_number>\d+)/replies/$', TicketRepliesAPIView.as_view(), name='api-v2.1-project-ticket-replies'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_number>\d+)/replies/(?P<reply_number>\d+)/$', TicketReplyAPIView.as_view(), name='api-v2.1-project-ticket-reply'),

    # tags
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tags/$', ProjectTagsAPIView.as_view(), name='api-v2.1-project-tags'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tags/(?P<tag_id>\d+)/$', ProjectTagAPIView.as_view(), name='api-v2.1-project-tag'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/tags/(?P<tag_id>\d+)/tickets/$', ProjectTagTicketsAPIView.as_view(), name='api-v2.1-project-tag-tickets'),

    # types
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/types/$', ProjectTypesAPIView.as_view(), name='api-v2.1-project-types'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/types/(?P<tag_id>\d+)/$', ProjectTypeAPIView.as_view(), name='api-v2.1-project-type'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/types/(?P<tag_id>\d+)/tickets/$', ProjectTypeTicketsAPIView.as_view(), name='api-v2.1-project-type-tickets'),

     # views
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-folders/$', TicketFolders.as_view(), name='api-v2.1-project-ticket-folders'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-views/$', TicketViewsAPI.as_view(), name='api-v2.1-project-ticket-views'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-views/(?P<view_id>.+)/$', TicketViewView.as_view(), name='api-v2.1-project-ticket-view'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-move-views/$', TicketViewsMoveView.as_view(), name='api-v2.1-project-ticket-views-move'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-duplicate-view/$', TicketViewsDuplicateView.as_view(), name='api-v2.1-project-ticket-view-duplicate'),

]

# files, must at last
urlpatterns += [
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/upload-file/$', ProjectUploadFileAPIView.as_view(), name='api-v2.1-project-upload-file'),
    re_path(r'^upload-file/project/(?P<project_uuid>[-0-9a-f]+)/(?P<file_path>.*)$', GetProjectUploadFileView.as_view(), name='api-v2.1-get-project-upload-file'),

    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/(?P<file_path>.*)$', ProjectFileAPIView.as_view(), name='api-v2.1-project-file'),
    re_path(r'^file/project/(?P<project_uuid>[-0-9a-f]+)/(?P<file_path>.*)$', GetProjectFileView.as_view(), name='api-v2.1-get-project-file'),
]
