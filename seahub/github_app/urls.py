from django.urls import path, re_path
from . import views

urlpatterns = [
    re_path(r'^oauth/auth/$', views.github_oauth_auth, name="github_oauth_auth"),
    path("login/", views.github_login, name="github_login"),
    path("callback/", views.github_callback, name="github_callback"),
    path("available-installations/", views.available_installations, name="available_installations"),
]
