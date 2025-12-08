# -*- coding: utf-8 -*-
from django.urls import re_path

from seahub.knowledge_base.knowledge_base import KnowledgeBasesAPIView
from seahub.knowledge_base.knowledge_base_views import KnowledgeBaseViewsAPI, KnowledgeBaseViewView, \
    KnowledgeBaseViewsMoveView, KnowledgeBaseViewsDuplicateView


urlpatterns = [
    # Knowledge bases
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-bases/$', KnowledgeBasesAPIView.as_view(),
            name='api-v2.1-knowledge-bases-api'),

    # Knowledge base view
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base-views/$', KnowledgeBaseViewsAPI.as_view(),
            name='api-v2.1-knowledge-base-view'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base-views/(?P<view_id>.+)/$',
            KnowledgeBaseViewView.as_view(), name='api-v2.1-knowledge-base-view-view'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base-move-views/$',
            KnowledgeBaseViewsMoveView.as_view(), name='api-v2.1-knowledge-base-move-view'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base-duplicate-views/$',
            KnowledgeBaseViewsDuplicateView.as_view(), name='api-v2.1-knowledge-base-duplicate-view'),
]
