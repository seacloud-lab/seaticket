# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path

from .views import TwilioCallApp


urlpatterns = [
    re_path(
        r'^twilio/inbound/two_factor/(?P<token>\d+)/$',
        view=TwilioCallApp.as_view(),
        name='twilio_call_app',
    ),
]
