# -*- coding: utf-8 -*-
from django.urls import re_path

from .views import portal_view, portal_edit_view, portal_anonymous_validate, portal_external_invitation_accept_view
from .apis import PortalTicketsView, PortalMyTicketsView, PortalTagsView, \
    PortalKnowledgeBaseViewsView, PortalKnowledgeBaseRecordsView, PortalTicketMetadataView, PortalSettingsView, \
    PortalExternalInvitationsView, PortalExternalLoginSendCodeView, PortalExternalLoginVerifyCodeView, \
    PortalExternalUsersView


urlpatterns = [
    # portal edit page (for admins)
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/submit-ticket/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/my-tickets/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/$', portal_edit_view, name='portal_edit_view'),

    # portal page (for external users)
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/submit-ticket/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/my-tickets/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/anonymous-validate/$', portal_anonymous_validate, name='portal_anonymous_validate'),

    # portal API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/tickets/$', PortalTicketsView.as_view(), name='api-v1-portal-tickets'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/my-tickets/$', PortalMyTicketsView.as_view(), name='api-v1-portal-my-tickets'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/tags/$', PortalTagsView.as_view(), name='api-v1-portal-tags'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-base-views/$', PortalKnowledgeBaseViewsView.as_view(), name='api-v1-portal-knowledge-base-views'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/knowledge-bases/$', PortalKnowledgeBaseRecordsView.as_view(), name='api-v1-portal-knowledge-bases'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/ticket/metadata/$', PortalTicketMetadataView.as_view(), name='api-v1-portal-ticket-metadata'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-invitations/$', PortalExternalInvitationsView.as_view(), name='api-v1-portal-external-invitations'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-invitations/(?P<token>[a-f0-9]{32})/$', PortalExternalInvitationsView.as_view(), name='api-v1-portal-external-invitations-detail'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-login/send-code/$', PortalExternalLoginSendCodeView.as_view(), name='api-v1-portal-external-login-send-code'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-login/verify/$', PortalExternalLoginVerifyCodeView.as_view(), name='api-v1-portal-external-login-verify'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/external-users/$', PortalExternalUsersView.as_view(), name='api-v1-portal-external-users'),
    re_path(r'^portal-external/accept/(?P<token>[a-f0-9]{32})/(?P<project_uuid>[-0-9a-f]{36})/$', portal_external_invitation_accept_view, name='portal_external_invitation_accept_view'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/settings/$', PortalSettingsView.as_view(), name='api-v1-portal-settings'),

]
