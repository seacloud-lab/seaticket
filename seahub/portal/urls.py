# -*- coding: utf-8 -*-
from django.urls import re_path

from seahub.project.views import project_view
from .views import portal_view, portal_edit_view, portal_anonymous_validate, portal_external_invitation_accept_view, portal_login_view, portal_external_logout_view
from .apis import PortalTagsView, PortalKnowledgeBaseViewsView, PortalKnowledgeBaseRecordsView, PortalKnowledgeBaseRecordView, PortalIssueMetadataView, \
    PortalSettingsView, PortalExternalInvitationsView, PortalExternalLoginSendCodeView, PortalExternalLoginVerifyCodeView, PortalIssueViewsView, \
    PortalIssueViewView, PortalExternalUsersView, PortalUserListView, PortalIssueViewsMoveView, PortalIssueViewsDuplicateView,\
    PortalIssuesView, PortalMyIssuesView, PortalIssueView, PortalIssueCommentsView, PortalIssueCommentView, PortalIssueTrashAPIView, \
    PortalLogoUploadView, PortalLogoView
from .portal_issue_types import PortalIssueTypesAPIView, PortalIssueTypeAPIView
from .portal_issue_substates import PortalIssueSubstatesAPIView, PortalIssueSubstateAPIView
from .chat.apis import (
    PortalChatSessionsView, PortalChatSessionView, PortalChatMessagesView,
    PortalChatView
)


urlpatterns = [
    # portal edit page (for admins)
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/submit-issue/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/my-issues/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/my-issues/(?P<issue_id>\d+)/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base/(?P<children_id>\d+)/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/chat/(?P<session_uuid>[-0-9a-f]{36})/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/chat/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/$', portal_edit_view, name='portal_edit_view'),

    # portal page (for external users)
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/submit-issue/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/my-issues/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/my-issues/(?P<issue_id>\d+)/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base/(?P<children_id>\d+)/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/chat/(?P<session_uuid>[-0-9a-f]{36})/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/chat/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/anonymous-validate/$', portal_anonymous_validate, name='portal_anonymous_validate'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/login/$', portal_login_view, name='portal_login_view'),

    # portal page
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/$', project_view, name='project_portal_issues_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/(?P<children_id>\d+)/$', project_view, name='project_portal_issues_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/trash/$', project_view, name='project_portal_issues_trash_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/types/$', project_view, name='project_portal_issues_types_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/portal-issues/substates/$', project_view, name='project_portal_issues_substates_view'),
    
    # portal API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/tags/$', PortalTagsView.as_view(), name='api-v1-portal-tags'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base-views/$', PortalKnowledgeBaseViewsView.as_view(), name='api-v1-portal-knowledge-base-views'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-bases/$', PortalKnowledgeBaseRecordsView.as_view(), name='api-v1-portal-knowledge-bases'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-bases/(?P<knowledge_id>\d+)/$', PortalKnowledgeBaseRecordView.as_view(), name='api-v1-portal-knowledge-base-record'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/user-list/$', PortalUserListView.as_view(), name='api-v1-portal-user-list'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issue/metadata/$', PortalIssueMetadataView.as_view(), name='api-v1-portal-issue-metadata'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-invitations/$', PortalExternalInvitationsView.as_view(), name='api-v1-portal-external-invitations'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-invitations/(?P<token>[a-f0-9]{32})/$', PortalExternalInvitationsView.as_view(), name='api-v1-portal-external-invitations-detail'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-login/send-code/$', PortalExternalLoginSendCodeView.as_view(), name='api-v1-portal-external-login-send-code'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-login/verify/$', PortalExternalLoginVerifyCodeView.as_view(), name='api-v1-portal-external-login-verify'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-users/$', PortalExternalUsersView.as_view(), name='api-v1-portal-external-users'),
    re_path(r'^portal-external/accept/(?P<token>[a-f0-9]{32})/(?P<project_uuid>[-0-9a-f]{36})/$', portal_external_invitation_accept_view, name='portal_external_invitation_accept_view'),
    re_path(r'^portal-external/logout/(?P<project_uuid>[-0-9a-f]{36})/$', portal_external_logout_view, name='portal_external_logout_view'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/settings/$', PortalSettingsView.as_view(), name='api-v1-portal-settings'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/logo/$', PortalLogoUploadView.as_view(), name='api-v1-portal-logo'),
    re_path(r'^portal-logo/(?P<project_uuid>[-0-9a-f]{36})/(?P<logo_filename>[^/]+)$', PortalLogoView.as_view(), name='portal-logo'),


    # portal issues API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/$', PortalIssuesView.as_view(), name='api-v1-portal-issues'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/my-issues/$', PortalMyIssuesView.as_view(), name='api-v1-portal-my-issues'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/(?P<issue_id>\d+)/$', PortalIssueView.as_view(), name='api-v1-portal-issue'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/(?P<issue_id>\d+)/comments/$', PortalIssueCommentsView.as_view(), name='api-v1-portal-issue-comments'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/(?P<issue_id>\d+)/comments/(?P<comment_id>\d+)/$', PortalIssueCommentView.as_view(), name='api-v1-portal-issue-comment'),

    # portal issues views API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]+)/portal-issues/views/$', PortalIssueViewsView.as_view(), name='api-v1-portal-issues-views'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]+)/portal-issues/views/move/$', PortalIssueViewsMoveView.as_view(), name='api-v1-portal-issues-views-move'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]+)/portal-issues/views/duplicate/$', PortalIssueViewsDuplicateView.as_view(), name='api-v1-portal-issues-view-duplicate'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]+)/portal-issues/views/(?P<view_id>.+)/$', PortalIssueViewView.as_view(), name='api-v1-portal-issues-view'),

    # portal issue types API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]+)/portal-issues/types/$', PortalIssueTypesAPIView.as_view(), name='api-v1-portal-issues-types'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]+)/portal-issues/types/(?P<type_id>[^/]+)/$', PortalIssueTypeAPIView.as_view(), name='api-v1-portal-issues-type'),

    # portal issue substates API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]+)/portal-issues/substates/$', PortalIssueSubstatesAPIView.as_view(), name='api-v1-portal-issues-substates'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]+)/portal-issues/substates/(?P<substate_id>[^/]+)/$', PortalIssueSubstateAPIView.as_view(), name='api-v1-portal-issues-substate'),

    # portal issues trash API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]+)/portal-issues/trash/$', PortalIssueTrashAPIView.as_view(), name='api-v1-portal-issues-trash'),

    # portal chat API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/$', PortalChatView.as_view(), name='api-v1-portal-chat'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/$', PortalChatSessionsView.as_view(), name='api-v1-portal-chat-sessions'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/$', PortalChatSessionView.as_view(), name='api-v1-portal-chat-session'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/messages/$', PortalChatMessagesView.as_view(), name='api-v1-portal-chat-messages'),
]
