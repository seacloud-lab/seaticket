# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path
from .views import *

urlpatterns = [
    re_path(r'^add/$', notification_add, name='notification_add'),
    re_path(r'^delete/(?P<nid>[\d]+)/$', notification_delete, name='notification_delete'),
    re_path(r'^set-primary/(?P<nid>[\d]+)/$', set_primary, name='set_primary'),

########## user notifications
    re_path(r'^list/$', user_notification_list, name='user_notification_list'),
    re_path(r'^more/$', user_notification_more, name='user_notification_more'),
    re_path(r'^remove/$', user_notification_remove, name='user_notification_remove'),
]
