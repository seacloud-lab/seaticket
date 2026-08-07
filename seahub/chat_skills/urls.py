# -*- coding: utf-8 -*-
from django.urls import re_path

from seahub.chat_skills.views import ChatSkillsAPIView, ChatSkillAPIView, ChatSkillValidateAPIView


urlpatterns = [
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/chat-skills/$', ChatSkillsAPIView.as_view(), name='api-v1-chat-skills'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/chat-skills/validate/$', ChatSkillValidateAPIView.as_view(), name='api-v1-chat-skills-validate'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/chat-skills/(?P<skill_name>[a-z0-9-]+)/$', ChatSkillAPIView.as_view(), name='api-v1-chat-skill'),
]
