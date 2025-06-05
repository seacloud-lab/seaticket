# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path
from seahub.two_factor.views import (BackupTokensView, SetupCompleteView,
                                     ProfileView, SetupView, QRGeneratorView,
                                     TwoFactorVerifyView, DisableView)

urlpatterns = [
    # re_path(r'^$',
    #     view=ProfileView.as_view(),
    #     name='profile', ),
    re_path(r'^setup/$',
        view=SetupView.as_view(),
        name='setup', ),
    re_path(r'^qrcode$',
        view=QRGeneratorView.as_view(),
        name='qr', ),
    re_path(r'^setup/complete/$',
        view=SetupCompleteView.as_view(),
        name='setup_complete', ),
    re_path(r'^backup/tokens/$',
        view=BackupTokensView.as_view(),
        name='backup_tokens', ),
    re_path(r'^disable/$',
        view=DisableView.as_view(),
        name='disable', ),
    re_path(r'verify/^$',
        view=TwoFactorVerifyView.as_view(),
        name='verify', ),
]
