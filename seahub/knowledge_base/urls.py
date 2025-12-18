# -*- coding: utf-8 -*-
from django.urls import re_path

from seahub.knowledge_base.knowledge_base import KnowledgeBasesAPIView, KnowledgeBaseAPIView, KnowledgeBaseMetadataAPIView
from seahub.knowledge_base.knowledge_base_views import KnowledgeBaseViewsAPI, KnowledgeBaseViewView, \
    KnowledgeBaseViewsMoveView, KnowledgeBaseViewsDuplicateView
from seahub.knowledge_base.knowledge_base_tags import KnowledgeBaseTagsAPIView, KnowledgeBaseTagAPIView


urlpatterns = [
    # Knowledge bases
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-bases/$', KnowledgeBasesAPIView.as_view(), name='api-v2.1-knowledge-bases-api'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-bases/(?P<knowledge_id>\d+)/$', KnowledgeBaseAPIView.as_view(), name='api-v2.1-knowledge-base-api'),

    # Knowledge base view
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base-views/$', KnowledgeBaseViewsAPI.as_view(), name='api-v2.1-knowledge-base-view'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base-views/(?P<view_id>.+)/$', KnowledgeBaseViewView.as_view(), name='api-v2.1-knowledge-base-view-view'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base-move-views/$', KnowledgeBaseViewsMoveView.as_view(), name='api-v2.1-knowledge-base-move-view'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base-duplicate-views/$', KnowledgeBaseViewsDuplicateView.as_view(), name='api-v2.1-knowledge-base-duplicate-view'),

    # Knowledge base tags
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base/tags/$', KnowledgeBaseTagsAPIView.as_view(), name='api-v2.1-knowledge-base-tags'),
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base/tags/(?P<tag_id>[-0-9a-zA-Z]{4})/$', KnowledgeBaseTagAPIView.as_view(), name='api-v2.1-knowledge-base-tag'),

    # Knowledge base metadata
    re_path(r'^api/v2.1/project/(?P<project_uuid>[-0-9a-f]+)/knowledge-base/metadata/$', KnowledgeBaseMetadataAPIView.as_view(), name='api-v2.1-knowledge-base-metadata'),
]
