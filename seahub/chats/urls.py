# -*- coding: utf-8 -*-
from django.urls import re_path
from seahub.chats.view import ChatSessionsView, ChatSessionView, ChatMessagesView, ChatView, ChatSessionTitleView

urlpatterns = [
    re_path(r'^api/v1/ai/chat/$', ChatView.as_view(), name='api-v1-chat-view'),
    re_path(r'^api/v1/chat/sessions/$', ChatSessionsView.as_view(), name='chat-sessions'),
    re_path(r'^api/v1/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/$', ChatSessionView.as_view(), name='chat-session'),
    re_path(r'^api/v1/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/generate-title/$', ChatSessionTitleView.as_view(), name='chat-session-generate-title'),
    re_path(r'^api/v1/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/messages/$', ChatMessagesView.as_view(), name='chat-messages'),
]
