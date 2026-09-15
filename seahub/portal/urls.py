# -*- coding: utf-8 -*-
from django.urls import re_path

from seahub.project.views import project_view
from .views import portal_edit_view
from .apis import PortalTagsView, PortalKnowledgeBaseViewsView, PortalKnowledgeBaseRecordsView, PortalKnowledgeBaseFeaturedArticlesView, PortalKnowledgeBaseRecordView, PortalIssueMetadataView, \
    PortalSettingsView, PortalExternalInvitationsView, PortalIssueViewsView, PortalIssueViewView, PortalExternalUsersView, PortalUserListView, \
    PortalCustomersView, PortalCustomerView, PortalCustomerMembersView, PortalCustomerMemberView, PortalIssueViewsMoveView, PortalIssueViewsDuplicateView, \
    PortalIssuesView, PortalMyIssuesView, PortalTeamIssuesView, PortalIssueView, PortalIssueCommentsView, \
    PortalIssueCommentView, PortalIssueTrashAPIView, PortalCustomDomainView, PortalCustomDomainVerificationView, PortalDomainAliasView, \
    PortalPreviewTokenView, PortalLogoView, PortalBackgroundImageView
from .portal_issue_types import PortalIssueTypesAPIView, PortalIssueTypeAPIView
from .portal_issue_substates import PortalIssueSubstatesAPIView, PortalIssueSubstateAPIView
from .chat.apis import (
    PortalChatSessionsView, PortalChatSessionView, PortalChatMessagesView,
    PortalChatView, PortalChatSessionTitleView, PortalChatImageView,
    PortalAdminChatSessionsView, PortalAdminChatMessagesView, PortalAdminChatStatisticsView
)
from .files import (
    PortalUploadFileView, GetPortalUploadFileView, PortalFileView,
)


urlpatterns = [
    # portal edit page (for admins)
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/submit-issue/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/my-issues/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/my-issues/(?P<children_id>\d+)/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/team-issues/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/team-issues/(?P<issue_id>\d+)/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base/(?P<children_id>\d+)/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/chat/(?P<session_uuid>[-0-9a-f]{36})/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/chat/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/home/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/all-chat/(?P<session_uuid>[-0-9a-f]{36})/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/all-chat/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/$', portal_edit_view, name='portal_edit_view'),

    # portal page
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/$', project_view, name='project_portal_issues_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/(?P<children_id>\d+)/$', project_view, name='project_portal_issues_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/trash/$', project_view, name='project_portal_issues_trash_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/types/$', project_view, name='project_portal_issues_types_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/substates/$', project_view, name='project_portal_issues_substates_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/analysis/$', project_view, name='project_portal_issues_analysis_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/customers-and-users/$', project_view, name='project_portal_customers_and_users_view'),
    
    # portal API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/tags/$', PortalTagsView.as_view(), name='api-v1-portal-tags'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base-views/$', PortalKnowledgeBaseViewsView.as_view(), name='api-v1-portal-knowledge-base-views'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-bases/$', PortalKnowledgeBaseRecordsView.as_view(), name='api-v1-portal-knowledge-bases'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/featured-articles/$', PortalKnowledgeBaseFeaturedArticlesView.as_view(), name='api-v1-portal-featured-articles'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-bases/(?P<knowledge_id>\d+)/$', PortalKnowledgeBaseRecordView.as_view(), name='api-v1-portal-knowledge-base-record'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/user-list/$', PortalUserListView.as_view(), name='api-v1-portal-user-list'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issue/metadata/$', PortalIssueMetadataView.as_view(), name='api-v1-portal-issue-metadata'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-invitations/$', PortalExternalInvitationsView.as_view(), name='api-v1-portal-external-invitations'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-invitations/(?P<token>[a-f0-9]{32})/$', PortalExternalInvitationsView.as_view(), name='api-v1-portal-external-invitations-detail'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-users/$', PortalExternalUsersView.as_view(), name='api-v1-portal-external-users'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/customers/$', PortalCustomersView.as_view(), name='api-v1-portal-customers'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/customers/(?P<customer_id>\d+)/$', PortalCustomerView.as_view(), name='api-v1-portal-customer'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/customers/(?P<customer_id>\d+)/members/$', PortalCustomerMembersView.as_view(), name='api-v1-portal-customer-members'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/customers/(?P<customer_id>\d+)/members/(?P<member_id>\d+)/$', PortalCustomerMemberView.as_view(), name='api-v1-portal-customer-member'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/settings/$', PortalSettingsView.as_view(), name='api-v1-portal-settings'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/preview-token/$', PortalPreviewTokenView.as_view(), name='api-v1-portal-preview-token'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/domain-alias/$', PortalDomainAliasView.as_view(), name='api-v1-portal-domain-alias'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/custom-domain/$', PortalCustomDomainView.as_view(), name='api-v1-portal-custom-domain'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/custom-domain/verify/$', PortalCustomDomainVerificationView.as_view(), name='api-v1-portal-custom-domain-verify'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/logo/$', PortalLogoView.as_view(), name='api-v1-portal-logo'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/background-image/$', PortalBackgroundImageView.as_view(), name='api-v1-portal-background-image'),

    # portal upload file
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/upload-file/$', PortalUploadFileView.as_view(), name='api-v1-portal-upload-file'),
    re_path(r'^upload-file/portal/(?P<project_uuid>[-0-9a-f]{36})/(?P<file_path>.+)$', GetPortalUploadFileView.as_view(), name='api-v1-get-portal-upload-file'),
    re_path(r'^file/portal/(?P<project_uuid>[-0-9a-f]{36})/(?P<file_path>.*)$', PortalFileView.as_view(), name='api-v1-get-portal-file'),
    re_path(r'^file/portal-chat-image/(?P<project_uuid>[-0-9a-f]{36})/$', PortalChatImageView.as_view(), name='api-v1-portal-chat-image'),

    # portal issues API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/$', PortalIssuesView.as_view(), name='api-v1-portal-issues'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/my-issues/$', PortalMyIssuesView.as_view(), name='api-v1-portal-my-issues'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/team-issues/$', PortalTeamIssuesView.as_view(), name='api-v1-portal-team-issues'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/(?P<issue_id>\d+)/$', PortalIssueView.as_view(), name='api-v1-portal-issue'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/(?P<issue_id>\d+)/comments/$', PortalIssueCommentsView.as_view(), name='api-v1-portal-issue-comments'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/(?P<issue_id>\d+)/comments/(?P<comment_id>\d+)/$', PortalIssueCommentView.as_view(), name='api-v1-portal-issue-comment'),

    # portal issues views API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/portal-issues/views/$', PortalIssueViewsView.as_view(), name='api-v1-portal-issues-views'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/portal-issues/views/move/$', PortalIssueViewsMoveView.as_view(), name='api-v1-portal-issues-views-move'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/portal-issues/views/duplicate/$', PortalIssueViewsDuplicateView.as_view(), name='api-v1-portal-issues-view-duplicate'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/portal-issues/views/(?P<view_id>.+)/$', PortalIssueViewView.as_view(), name='api-v1-portal-issues-view'),

    # portal issue types API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/portal-issues/types/$', PortalIssueTypesAPIView.as_view(), name='api-v1-portal-issues-types'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/portal-issues/types/(?P<type_id>[^/]+)/$', PortalIssueTypeAPIView.as_view(), name='api-v1-portal-issues-type'),

    # portal issue substates API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/portal-issues/substates/$', PortalIssueSubstatesAPIView.as_view(), name='api-v1-portal-issues-substates'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/portal-issues/substates/(?P<substate_id>[^/]+)/$', PortalIssueSubstateAPIView.as_view(), name='api-v1-portal-issues-substate'),

    # portal issues trash API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/portal-issues/trash/$', PortalIssueTrashAPIView.as_view(), name='api-v1-portal-issues-trash'),

    # portal chat API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/$', PortalChatView.as_view(), name='api-v1-portal-chat'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/$', PortalChatSessionsView.as_view(), name='api-v1-portal-chat-sessions'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/$', PortalChatSessionView.as_view(), name='api-v1-portal-chat-session'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/generate-title/$', PortalChatSessionTitleView.as_view(), name='api-v1-portal-chat-session-generate-title'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/messages/$', PortalChatMessagesView.as_view(), name='api-v1-portal-chat-messages'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/admin/chat/sessions/$', PortalAdminChatSessionsView.as_view(), name='api-v1-portal-admin-chat-sessions'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/admin/chat/sessions/(?P<session_uuid>[-0-9a-f]{36})/messages/$', PortalAdminChatMessagesView.as_view(), name='api-v1-portal-admin-chat-messages'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/admin/chat/statistics/$', PortalAdminChatStatisticsView.as_view(), name='api-v1-portal-admin-chat-statistics'),
]
