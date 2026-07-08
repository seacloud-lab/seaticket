# -*- coding: utf-8 -*-
from django.conf import settings
from django.urls import include, re_path

from seahub.portal.views import portal_anonymous_validate, portal_external_invitation_accept_view, portal_external_logout_view, \
    portal_accounts_login_view, portal_login_view, portal_preview_view, portal_view
from seahub.portal.apis import PortalCustomDomainTLSAskView, PortalExternalLoginSendCodeView, PortalExternalLoginVerifyCodeView, \
    PortalIssueCommentView, PortalIssueCommentsView, PortalIssueMetadataView, PortalIssueView, PortalIssuesView, PortalKnowledgeBaseRecordView, \
    PortalKnowledgeBaseRecordsView, PortalKnowledgeBaseViewsView, PortalLogoView, PortalMyIssuesView, PortalTagsView, PortalUserListView

from seahub.portal.chat.apis import PortalChatMessagesView, PortalChatSessionTitleView, PortalChatSessionsView, PortalChatSessionView, \
    PortalChatView, PortalChatImageView
from seahub.portal.files import GetPortalUploadFileView, PortalFileView, PortalUploadFileView
from seahub.views import custom_css_view, i18n


urlpatterns = [
    re_path(r'^custom-css/$', custom_css_view, name='custom_css'),
    re_path(r'^i18n/$', i18n, name='i18n'),
    re_path(r'^captcha/', include('captcha.urls')),
    re_path(r'^accounts/login/$', portal_accounts_login_view, name='auth_login'),
    re_path(r'^accounts/', include('seahub.registration.urls')),

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
    re_path(r'^portal-preview/(?P<token>[^/]+)/$', portal_preview_view, name='portal_preview_view'),
    re_path(r'^portal-external/accept/(?P<token>[a-f0-9]{32})/(?P<project_uuid>[-0-9a-f]{36})/$', portal_external_invitation_accept_view, name='portal_external_invitation_accept_view'),
    re_path(r'^portal-external/logout/(?P<project_uuid>[-0-9a-f]{36})/$', portal_external_logout_view, name='portal_external_logout_view'),

    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/tags/$', PortalTagsView.as_view(), name='api-v1-portal-tags'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base-views/$', PortalKnowledgeBaseViewsView.as_view(), name='api-v1-portal-knowledge-base-views'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-bases/$', PortalKnowledgeBaseRecordsView.as_view(), name='api-v1-portal-knowledge-bases'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-bases/(?P<knowledge_id>\d+)/$', PortalKnowledgeBaseRecordView.as_view(), name='api-v1-portal-knowledge-base-record'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/user-list/$', PortalUserListView.as_view(), name='api-v1-portal-user-list'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issue/metadata/$', PortalIssueMetadataView.as_view(), name='api-v1-portal-issue-metadata'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-login/send-code/$', PortalExternalLoginSendCodeView.as_view(), name='api-v1-portal-external-login-send-code'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-login/verify/$', PortalExternalLoginVerifyCodeView.as_view(), name='api-v1-portal-external-login-verify'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/logo/$', PortalLogoView.as_view(), name='api-v1-portal-logo'),
    re_path(r'^internal/portal/custom-domain/allow-tls$', PortalCustomDomainTLSAskView.as_view(), name='internal-portal-custom-domain-allow-tls'),

    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/upload-file/$', PortalUploadFileView.as_view(), name='api-v1-portal-upload-file'),
    re_path(r'^upload-file/portal/(?P<project_uuid>[-0-9a-f]{36})/(?P<file_path>.+)$', GetPortalUploadFileView.as_view(), name='api-v1-get-portal-upload-file'),
    re_path(r'^file/portal/(?P<project_uuid>[-0-9a-f]{36})/(?P<file_path>.*)$', PortalFileView.as_view(), name='api-v1-get-portal-file'),
    re_path(r'^file/portal-chat-image/(?P<project_uuid>[-0-9a-f]{36})/$', PortalChatImageView.as_view(), name='api-v1-portal-chat-image'),

    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/$', PortalIssuesView.as_view(), name='api-v1-portal-issues'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/my-issues/$', PortalMyIssuesView.as_view(), name='api-v1-portal-my-issues'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/(?P<issue_id>\d+)/$', PortalIssueView.as_view(), name='api-v1-portal-issue'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/(?P<issue_id>\d+)/comments/$', PortalIssueCommentsView.as_view(), name='api-v1-portal-issue-comments'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/issues/(?P<issue_id>\d+)/comments/(?P<comment_id>\d+)/$', PortalIssueCommentView.as_view(), name='api-v1-portal-issue-comment'),

    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/$', PortalChatView.as_view(), name='api-v1-portal-chat'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/$', PortalChatSessionsView.as_view(), name='api-v1-portal-chat-sessions'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/$', PortalChatSessionView.as_view(), name='api-v1-portal-chat-session'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/generate-title/$', PortalChatSessionTitleView.as_view(), name='api-v1-portal-chat-session-generate-title'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/messages/$', PortalChatMessagesView.as_view(), name='api-v1-portal-chat-messages'),
]

if settings.SERVE_STATIC:
    from django.views.static import serve as static_view

    media_url = settings.MEDIA_URL.strip('/')
    urlpatterns += [
        re_path(r'^%s/(?P<path>.*)$' % media_url, static_view, {'document_root': settings.MEDIA_ROOT}),
    ]
