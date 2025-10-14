# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
from django import forms
from django.utils.translation import gettext_lazy as _

from seahub.base.accounts import User
from seahub.utils.licenseparse import user_number_over_limit
from seahub.role_permissions.utils import get_available_roles

class AddUserForm(forms.Form):
    """
    Form for adding a user.
    """
    email = forms.EmailField()
    name = forms.CharField(max_length=64, required=False)

    role = forms.ChoiceField(choices=[ (i, i) for i in get_available_roles() ])

    password1 = forms.CharField(widget=forms.PasswordInput())
    password2 = forms.CharField(widget=forms.PasswordInput())

    def clean_email(self):
        if user_number_over_limit():
            raise forms.ValidationError(_("The number of users exceeds the limit."))

        email = self.cleaned_data['email']
        try:
            user = User.objects.get(email=email)
            raise forms.ValidationError(_("A user with this email already exists."))
        except User.DoesNotExist:
            return self.cleaned_data['email']

    def clean_name(self):
        """
        should not include '/'
        """
        if "/" in self.cleaned_data["name"]:
            raise forms.ValidationError(_("Name should not include '/'."))

        return self.cleaned_data["name"]


    def clean(self):
        """
        Verifiy that the values entered into the two password fields
        match. Note that an error here will end up in
        ``non_field_errors()`` because it doesn't apply to a single
        field.

        """
        if 'password1' in self.cleaned_data and 'password2' in self.cleaned_data:
            if self.cleaned_data['password1'] != self.cleaned_data['password2']:
                raise forms.ValidationError(_("The two passwords didn't match."))
        return self.cleaned_data


class SetUserQuotaForm(forms.Form):
    """
    Form for setting user quota.
    """
    space_quota = forms.IntegerField(min_value=0,
                               error_messages={'required': _('Space quota can\'t be empty'),
                                               'min_value': _('Space quota is too low (minimum value is 0)')})

class BatchAddUserForm(forms.Form):
    """
    Form for importing users from XLSX file.
    """
    file = forms.FileField()
