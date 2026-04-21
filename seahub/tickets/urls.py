# -*- coding: utf-8 -*-
from django.urls import re_path

from seahub.project.views import project_view
from .ticket_types import TicketTypesAPIView, TicketTypeAPIView
from .ticket_substates import TicketSubstatesAPIView, TicketSubstateAPIView
from .tickets import TicketsAPIView, TicketAPIView, TicketCommentsAPIView, TicketCommentAPIView, \
    TicketsSearchAPIView, MyTicketAPIView, TicketMetadataAPIView, TicketTrashAPIView, TicketActivitiesAPIView
from .ticket_views import TicketFolders, TicketViewsAPI, TicketViewView, \
    TicketViewsMoveView, TicketViewsDuplicateView


urlpatterns = [
    # tickets page
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/types/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/types/(?P<children_id>[-0-9a-zA-Z]{4})/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/substates/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/substates/(?P<children_id>[-0-9a-zA-Z]{4})/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/new/$', project_view, name='project_view'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/(?P<children_id>\d+)/$', project_view, name='project_view'),

    # ticket
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/$', TicketsAPIView.as_view(), name='api-v1-project-tickets'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_id>\d+)/$', TicketAPIView.as_view(), name='api-v1-project-ticket'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_id>\d+)/comments/$', TicketCommentsAPIView.as_view(), name='api-v1-project-ticket-comments'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_id>\d+)/comments/(?P<comment_id>\d+)/$', TicketCommentAPIView.as_view(), name='api-v1-project-ticket-comment'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/(?P<ticket_id>\d+)/activities/$', TicketActivitiesAPIView.as_view(), name='api-v1-project-ticket-activities'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/search/$', TicketsSearchAPIView.as_view(), name='api-v1-project-tickets-search'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/tickets/trash/$', TicketTrashAPIView.as_view(), name='api-v1-project-tickets-trash'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/my-tickets/$', MyTicketAPIView.as_view(), name='api-v1-project-my-tickets'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket/metadata/$', TicketMetadataAPIView.as_view(), name='api-v1-project-ticket-metadata'),

    # types
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket/types/$', TicketTypesAPIView.as_view(), name='api-v1-project-types'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket/types/(?P<type_id>[-0-9a-zA-Z]{4})/$', TicketTypeAPIView.as_view(), name='api-v1-project-type'),

    # substates
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket/substates/$', TicketSubstatesAPIView.as_view(), name='api-v1-project-substates'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket/substates/(?P<substate_id>[-0-9a-zA-Z]{4})/$', TicketSubstateAPIView.as_view(), name='api-v1-project-substate'),

    # ticket views
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-folders/$', TicketFolders.as_view(), name='api-v1-project-ticket-folders'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-views/$', TicketViewsAPI.as_view(), name='api-v1-project-ticket-views'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-views/(?P<view_id>.+)/$', TicketViewView.as_view(), name='api-v1-project-ticket-view'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-move-views/$', TicketViewsMoveView.as_view(), name='api-v1-project-ticket-views-move'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]+)/ticket-duplicate-view/$', TicketViewsDuplicateView.as_view(), name='api-v1-project-ticket-view-duplicate'),

    # my-tickets
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/my-tickets/$', project_view, name='project_view'),

    # new-ticket
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/new-ticket/$', project_view, name='project_view'),

    # trash
    re_path(r'^workspace/(?P<workspace_id>\d+)/project/(?P<project_name>.*)/tickets/trash/$', project_view, name='project_view'),
]
