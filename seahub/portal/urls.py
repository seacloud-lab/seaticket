# -*- coding: utf-8 -*-
from django.urls import re_path

from .views import portal_view, portal_edit_view
from .apis import PortalTicketsView, PortalMyTicketsView, PortalTicketTypesView, PortalTicketTagsView

urlpatterns = [
    # portal edit page (for admins)
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/submit-ticket/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/my-tickets/$', portal_edit_view, name='portal_edit_view'),
    re_path(r'^portal-edit/(?P<project_uuid>[-0-9a-f]{36})/$', portal_edit_view, name='portal_edit_view'),

    # portal page (for external users)
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/submit-ticket/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/my-tickets/$', portal_view, name='portal_view'),
    re_path(r'^portal/(?P<project_uuid>[-0-9a-f]{36})/$', portal_view, name='portal_view'),

    # portal API
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/tickets/$', PortalTicketsView.as_view(), name='api-v1-portal-tickets'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/my-tickets/$', PortalMyTicketsView.as_view(), name='api-v1-portal-my-tickets'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/ticket/types/$', PortalTicketTypesView.as_view(), name='api-v1-portal-ticket-types'),
    re_path(r'^api/v1/portal/(?P<project_uuid>[-0-9a-f]{36})/ticket/tags/$', PortalTicketTagsView.as_view(), name='api-v1-portal-ticket-tags'),
]
