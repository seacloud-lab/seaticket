# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
from django import forms
from django.utils.translation import gettext_lazy as _

from seahub.profile.models import Profile
from seahub.settings import ENABLE_UPDATE_USER_INFO


class ProfileForm(forms.Form):
    nickname = forms.CharField(max_length=64, required=False)
    intro = forms.CharField(max_length=256, required=False)

    def __init__(self, user, *args, **kwargs):
        self.user = user

        super(ProfileForm, self).__init__(*args, **kwargs)

    def clean_nickname(self):
        """
        Validates that nickname should not include '/'
        """
        if not ENABLE_UPDATE_USER_INFO:
            raise forms.ValidationError(_("Permission denied."))

        if "/" in self.cleaned_data["nickname"]:
            raise forms.ValidationError(_("Name should not include '/'."))

        return self.cleaned_data["nickname"]

    def save(self):
        username = self.user.username
        nickname = self.cleaned_data['nickname']
        intro = self.cleaned_data['intro']
        Profile.objects.add_or_update(username, nickname, intro)

