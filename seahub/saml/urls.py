from django.urls import re_path

from seahub.saml.views import login, acs, metadata, saml_connect, saml_disconnect


urlpatterns = [
    re_path(r'^login/', login, name='saml_login'),
    re_path(r'^acs/$', acs, name="saml_acs"),
    re_path(r'^metadata/$', metadata, name="saml_metadata"),
    re_path(r'^connect/$', saml_connect, name='saml_connect'),
    re_path(r'^disconnect/$', saml_disconnect, name='saml_disconnect'),
]
