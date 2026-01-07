# -*- coding: utf-8 -*-
from django.urls import re_path

from .views import project_view

from .apis import ProjectRelatedUsersView, ProjectItemsSearchView
from .connections import ProjectConnectionsView, ProjectConnectionView, ProjectConnectionSyncView, \
    ProjectConnectionDetailsView, GithubWebhookView, ProjectConnectionRowDetailView, DiscourseWebhookView, \
    ProjectConnectionsStatusView, ProjectConnectionLogView, ProjectConnectionRecordView, ProjectConnectionRecordsView, ConnectionFileView
from .files import ProjectUploadFileAPIView, GetProjectUploadFileView, \
    ProjectFileAPIView, GetProjectFileView
from .connections_views import ConnectionViewsAPI, ConnectionViewAPI, \
    ConnectionViewsMoveView, ConnectionViewsDuplicateView
from .ai import ConvertRecordToTicket, EmbeddingAnalysisView, EmbeddingAnalysisTaskStatusView, RelatedRecordsView
from .api_tokens import ProjectAPITokensView, ProjectAPITokenView
from .token_connections import ProjectConnectionListByTokenView, ProjectConnectionDetailByTokenView, \
    ProjectConnectionRowDetailByTokenView
from .search import SearchTickectsAndDocumentsView


urlpatterns = [
    # project page
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/knowledge-base/trash/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/chat/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/chat/(?P<children_id>[-0-9a-zA-Z]{36})/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/search/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/connections/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/connections/(?P<children_id>\d+)/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/connections/(?P<children_id>\d+)/records/(?P<record_id>\d+)/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/settings/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/analyze/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/knowledge-base/tags/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/knowledge-base/tags/(?P<children_id>[-0-9a-zA-Z]+)/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/knowledge-base/new/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/knowledge-base/(?P<children_id>\d+)/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/knowledge-base/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/$', project_view, name='project_view'),

    # user: related users
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/related-users/$', ProjectRelatedUsersView.as_view(), name='api-v1-project-related-users'),

    # project: items search
    re_path(r'^api/v1/project/items-search/$', ProjectItemsSearchView.as_view(), name='api-v1-project-items-search'),

    # API tokens
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/api-tokens/$', ProjectAPITokensView.as_view(), name='api-v1-project-api-tokens'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/api-tokens/(?P<token_id>\d+)/$', ProjectAPITokenView.as_view(), name='api-v1-project-api-token'),
    re_path(r'^api/v1/project/connection-list/$', ProjectConnectionListByTokenView.as_view(), name='api-v1-connection-list-by-token'),
    re_path(r'^api/v1/project/connection-details/$', ProjectConnectionDetailByTokenView.as_view(), name='api-v1-connection-details-by-token'),
    re_path(r'^api/v1/project/connection-row-details/$', ProjectConnectionRowDetailByTokenView.as_view(), name='api-v1-connection-row-details-by-token'),

    #sync data
    re_path(r'webhook/github', GithubWebhookView.as_view(), name='github_webhook'),
    re_path(r'webhook/discourse', DiscourseWebhookView.as_view(), name='discourse_webhook'),

    # connections
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/$', ProjectConnectionsView.as_view(), name='api-v1-connections'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/$', ProjectConnectionView.as_view(), name='api-v1-connection'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/sync/$', ProjectConnectionSyncView.as_view(), name='api-v1-connection-sync'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/details/$', ProjectConnectionDetailsView.as_view(), name='api-v1-connection-details'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/details/row-detail/$', ProjectConnectionRowDetailView.as_view(), name='api-v1-connection-row-detail'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/query-status/$', ProjectConnectionsStatusView.as_view(), name='api-v1-connection-status'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/logs/$', ProjectConnectionLogView.as_view(), name='api-v1-connection-logs'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/records/$', ProjectConnectionRecordsView.as_view(), name='api-v1-connection-records'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/connections/(?P<connection_id>\d+)/records/(?P<record_id>\d+)/$', ProjectConnectionRecordView.as_view(), name='api-v1-connection-record'),

    # connection views
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/connections/(?P<connection_id>\d+)/views/$', ConnectionViewsAPI.as_view(), name='api-v1-connection-views'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/connections/(?P<connection_id>\d+)/views/(?P<view_id>.+)/$', ConnectionViewAPI.as_view(), name='api-v1-connection-view'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/connections/(?P<connection_id>\d+)/move-views/$', ConnectionViewsMoveView.as_view(), name='api-v1-connection-views-move'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/connections/(?P<connection_id>\d+)/duplicate-view/$', ConnectionViewsDuplicateView.as_view(), name='api-v1-connection-view-duplicate'),

    # search
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/search-tickets-and-documents/$', SearchTickectsAndDocumentsView.as_view(), name='api-v1-search-ticket-and-documents'),

    re_path(r'^api/v1/ai/convert-record-to-ticket/$', ConvertRecordToTicket.as_view(), name='api-v1-ai-create-ticket'),
    re_path(r'^api/v1/ai/embedding-analysis/$', EmbeddingAnalysisView.as_view(), name='api-v1-ai-embedding-analysis'),
    re_path(r'^api/v1/ai/embedding-analysis-task-status/(?P<task_id>[-0-9a-zA-Z]+)/$', EmbeddingAnalysisTaskStatusView.as_view(), name='api-v1-ai-embedding-analysis-task-status'),
    re_path(r'^api/v1/ai/related-records/$', RelatedRecordsView.as_view(), name='api-v1-ai-related-records'),
]

# files, must at last
urlpatterns += [
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/upload-file/$', ProjectUploadFileAPIView.as_view(), name='api-v1-project-upload-file'),
    re_path(r'^upload-file/project/(?P<project_uuid>[-0-9a-f]+)/(?P<file_path>.*)$', GetProjectUploadFileView.as_view(), name='api-v1-get-project-upload-file'),

    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/(?P<file_path>.*)$', ProjectFileAPIView.as_view(), name='api-v1-project-file'),
    re_path(r'^file/project/(?P<project_uuid>[-0-9a-f]+)/connections/(?P<connection_id>\d+)/path/(?P<file_path>.*)$', ConnectionFileView.as_view(), name='api-v1-connection-file'),
    re_path(r'^file/project/(?P<project_uuid>[-0-9a-f]+)/(?P<file_path>.*)$', GetProjectFileView.as_view(), name='api-v1-get-project-file'),
]
