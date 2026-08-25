# -*- coding: utf-8 -*-
from django.urls import re_path

from seahub.skills.views import SkillsAPIView, SkillAPIView, SkillCommandsAPIView


urlpatterns = [
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/skills/$', SkillsAPIView.as_view(), name='api-v1-skills'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/skills/commands/$', SkillCommandsAPIView.as_view(), name='api-v1-skills-commands'),
    re_path(r'^api/v1/project/(?P<project_uuid>[-0-9a-f]{36})/skills/(?P<skill_name>[a-z0-9-]+)/$', SkillAPIView.as_view(), name='api-v1-skill'),
]
