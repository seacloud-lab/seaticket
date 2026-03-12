"""
Forms and validation code for user registration.

"""
import re

from django.contrib.auth.models import User
from django import forms
from django.utils.translation import gettext_lazy as _

from seahub.utils import is_user_password_strong
from seahub.profile.models import Profile
from seahub.utils.password import get_password_strength_requirements
from seahub.settings import USER_PASSWORD_MIN_LENGTH, USER_PASSWORD_STRENGTH_LEVEL, \
    USER_STRONG_PASSWORD_REQUIRED

# I put this on all required fields, because it's easier to pick up
# on them with CSS or JavaScript if they have a class of "required"
# in the HTML. Your mileage may vary. If/when Django ticket #3515
# lands in trunk, this will no longer be necessary.
attrs_dict = {'class': 'input'}


class RegistrationForm(forms.Form):
    """
    Form for registering a new user account.

    Validates that the requested email is not already in use, and
    requires the password to be entered twice to catch typos.

    Subclasses should feel free to add any additional validation they
    need, but should avoid defining a ``save()`` method -- the actual
    saving of collected user data is delegated to the active
    registration backend.
    """

    name = forms.CharField(widget=forms.TextInput(
        attrs=dict(attrs_dict, maxlength=64, placeholder=_("Name"))),
        label=_("name"))
    email = forms.CharField(widget=forms.TextInput(attrs=dict(attrs_dict, maxlength=75, placeholder=_("Email"))),
                            label=_("Email address"))
    userid = forms.RegexField(r'^\w+$',
                              max_length=40,
                              required=False,
                              widget=forms.TextInput(),
                              label=_("Username"),
                              error_messages={'invalid': _("This value must be of length 40")})
    password1 = forms.CharField(max_length=4096,
                                widget=forms.PasswordInput(
                                    attrs=dict(attrs_dict, render_value=False, placeholder=_("Password"))),
                                label=_("Password"))
    password2 = forms.CharField(max_length=4096,
                                widget=forms.PasswordInput(
                                    attrs=dict(attrs_dict, render_value=False,  placeholder=_("Confirm password"))),
                                label=_("Password (again)"))

    @classmethod
    def allow_register(cls, email):
        prog = re.compile(r"(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)",
                          re.IGNORECASE)
        return False if prog.match(email) is None else True

    def clean_email(self):
        email = self.cleaned_data['email']
        if not self.allow_register(email):
            raise forms.ValidationError(_("Enter a valid email address."))

        if Profile.objects.filter(contact_email=email).exists():
            raise forms.ValidationError(_("User %s already exists.") % email)

        emailuser = User.objects.filter(email=email).first()
        if not emailuser:
            return self.cleaned_data['email']
        else:
            raise forms.ValidationError(_("User %s already exists.") % email)

    def clean_userid(self):
        if self.cleaned_data['userid'] and len(self.cleaned_data['userid']) != 40:
            raise forms.ValidationError(_("Invalid user id."))
        return self.cleaned_data['userid']

    def clean_password1(self):
        if 'password1' in self.cleaned_data:
            pwd = self.cleaned_data['password1']

            if bool(is_user_password_strong(pwd)) is True:
                return pwd
            else:
                password_strength_requirements = get_password_strength_requirements()
                raise forms.ValidationError(
                    _(("%(pwd_len)s characters or more, include "
                        "%(num_types)s types or more of these: "
                        "letters(case sensitive), numbers, and symbols")) %
                    {'pwd_len': password_strength_requirements.get('min_len'),
                        'num_types': len(password_strength_requirements.get('char_types'))})

    def clean_password2(self):
        """
        Verifiy that the values entered into the two password fields
        match. Note that an error here will end up in
        ``non_field_errors()`` because it doesn't apply to a single
        field.

        """
        if 'password1' in self.cleaned_data and 'password2' in self.cleaned_data:
            if self.cleaned_data['password1'] != self.cleaned_data['password2']:
                raise forms.ValidationError(_("The two password fields didn't match."))
        return self.cleaned_data


class RegistrationFormTermsOfService(RegistrationForm):
    """
    Subclass of ``RegistrationForm`` which adds a required checkbox
    for agreeing to a site's Terms of Service.

    """
    tos = forms.BooleanField(widget=forms.CheckboxInput(attrs=attrs_dict),
                             label=_('I have read and agree to the Terms of Service'),
                             error_messages={'required': _("You must agree to the terms to register")})


class RegistrationFormUniqueEmail(RegistrationForm):
    """
    Subclass of ``RegistrationForm`` which enforces uniqueness of
    email addresses.

    """
    def clean_email(self):
        """
        Validate that the supplied email address is unique for the
        site.

        """
        if User.objects.filter(email__iexact=self.cleaned_data['email']):
            raise forms.ValidationError(_("This email address is already in use. "
                                          "Please supply a different email address."))
        return self.cleaned_data['email']


class RegistrationFormNoFreeEmail(RegistrationForm):
    """
    Subclass of ``RegistrationForm`` which disallows registration with
    email addresses from popular free webmail services; moderately
    useful for preventing automated spam registrations.

    To change the list of banned domains, subclass this form and
    override the attribute ``bad_domains``.

    """
    bad_domains = ['aim.com', 'aol.com', 'email.com', 'gmail.com',
                   'googlemail.com', 'hotmail.com', 'hushmail.com',
                   'msn.com', 'mail.ru', 'mailinator.com', 'live.com',
                   'yahoo.com']

    def clean_email(self):
        """
        Check the supplied email address against a list of known free
        webmail domains.

        """
        email_domain = self.cleaned_data['email'].split('@')[1]
        if email_domain in self.bad_domains:
            raise forms.ValidationError(_("Registration using free email addresses is prohibited. "
                                          "Please supply a different email address."))
        return self.cleaned_data['email']


class SmsRegistrationForm(forms.Form):

    name = forms.CharField(widget=forms.TextInput(
        attrs=dict(attrs_dict, maxlength=64, placeholder=_("Name"))),
        label=_("name"))
    password1 = forms.CharField(max_length=4096,
                                widget=forms.PasswordInput(
                                    attrs=dict(attrs_dict, render_value=False, placeholder=_("Password"))),
                                label=_("Password"))
    password2 = forms.CharField(max_length=4096,
                                widget=forms.PasswordInput(
                                    attrs=dict(attrs_dict, render_value=False,  placeholder=_("Confirm password"))),
                                label=_("Password (again)"))

    def clean_password1(self):
        if 'password1' in self.cleaned_data:
            pwd = self.cleaned_data['password1']

            if bool(USER_STRONG_PASSWORD_REQUIRED) is True:
                if bool(is_user_password_strong(pwd)) is True:
                    return pwd
                else:
                    raise forms.ValidationError(
                        _(("%(pwd_len)s characters or more, include "
                           "%(num_types)s types or more of these: "
                           "letters(case sensitive), numbers, and symbols")) %
                        {'pwd_len': USER_PASSWORD_MIN_LENGTH,
                         'num_types': USER_PASSWORD_STRENGTH_LEVEL})
            else:
                return pwd

    def clean_password2(self):
        if 'password1' in self.cleaned_data and 'password2' in self.cleaned_data:
            if self.cleaned_data['password1'] != self.cleaned_data['password2']:
                raise forms.ValidationError(_("The two password fields didn't match."))
        # set empty email in cleaned_data
        self.cleaned_data['email'] = ''
        return self.cleaned_data
