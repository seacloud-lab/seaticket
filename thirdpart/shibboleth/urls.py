from distutils.version import StrictVersion
import django
if StrictVersion(django.get_version()) < StrictVersion('1.4'):
    from django.conf.urls.defaults import *
else:
    from django.urls import re_path

from .views import ShibbolethView, ShibbolethLogoutView, ShibbolethLoginView

urlpatterns = [
    re_path(r'^login/$', ShibbolethLoginView.as_view(), name='login'),
    re_path(r'^logout/$', ShibbolethLogoutView.as_view(), name='logout'),
    re_path(r'^$', ShibbolethView.as_view(), name='info'),
]
