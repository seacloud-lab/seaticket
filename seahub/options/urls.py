# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path

from .views import *

urlpatterns = [
    re_path(r'^save/$', save_options, name='options_save'),
    re_path(r'^enable_sub_lib/$', sub_lib_enable_set, name='sub_lib_enable_set'),
]
