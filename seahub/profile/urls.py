# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path, include
from .views import *

urlpatterns = [
#    re_path(r'^list_user/$', 'list_userids', name="list_userids"),
    re_path(r'^$', edit_profile, name="edit_profile"),
    re_path(r'^delete/$', delete_user_account, name="delete_user_account"),
    re_path(r'^two_factor_authentication/', include(('seahub.two_factor.urls', 'two_factor'), namespace='two_factor')),
    re_path(r'^update-contact-email/(?P<update_key>.*)/$', update_contact_email_view, name="update_contact_email"),
]

# Move the catch-all pattern to the end.
urlpatterns += [
    re_path(r'^(?P<username>[^/]*)/$', user_profile, name="user_profile"),
]
