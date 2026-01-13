# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path

from .views import token_view, invitation_link_view
from seahub.base.generic import DirectTemplateView
from seahub.registration.forms import RegistrationForm

form_class = RegistrationForm

urlpatterns = [
    re_path(r'^token/(?P<token>[a-f0-9]{32})/$', token_view, name='token_view'),
    re_path(r'^link/(?P<token>[a-zA-Z0-9]+)/$', invitation_link_view, name='invitation_link_view'),

]
