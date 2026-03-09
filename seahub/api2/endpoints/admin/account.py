# Copyright (c) 2012-2016 Seafile Ltd.
import logging
from dateutil.relativedelta import relativedelta

from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.serializers import AccountSerializer
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.profile.models import Profile
from seahub.utils import is_valid_username


logger = logging.getLogger(__name__)
json_content_type = 'application/json; charset=utf-8'

def get_account_info(user):
    email = user.username
    profile = Profile.objects.get_profile_by_user(email)

    info = {}
    info['email'] = email
    info['name'] = email2nickname(email)
    info['institution'] = profile.institution if profile else ''
    info['id'] = user.id
    info['is_staff'] = user.is_staff
    info['is_active'] = user.is_active
    info['create_time'] = user.ctime
    info['login_id'] = profile.login_id if profile else ''
    info['list_in_address_book'] = profile.list_in_address_book if profile else False

    return info

class Account(APIView):
    """Query/Add/Delete a specific account.
    Administator permission is required.
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, email, format=None):
        if not is_valid_username(email):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Email %s invalid.' % email)

        # query account info
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'User %s not found.' % email)

        info = get_account_info(user)
        return Response(info)

    def _update_account_additional_info(self, request, email):

        # update account name
        name = request.data.get("name", None)
        if name is not None:
            profile = Profile.objects.get_profile_by_user(email)
            if profile is None:
                profile = Profile(user=email)
            profile.nickname = name
            profile.save()

        # update account list_in_address_book
        list_in_address_book = request.data.get("list_in_address_book", None)
        if list_in_address_book is not None:
            profile = Profile.objects.get_profile_by_user(email)
            if profile is None:
                profile = Profile(user=email)

            profile.list_in_address_book = list_in_address_book.lower() == 'true'
            profile.save()

        # update account loginid
        loginid = request.data.get("login_id", '').strip()
        if loginid != '':
            profile = Profile.objects.get_profile_by_user(email)
            if profile is None:
                profile = Profile(user=email)
            profile.login_id = loginid
            profile.save()

        # update user institution
        institution = request.data.get("institution", None)
        if institution is not None:
            profile = Profile.objects.get_profile_by_user(email)
            if profile is None:
                profile = Profile(user=email)
            profile.institution = institution
            profile.save()

        # update is_trial
        is_trial = request.data.get("is_trial", None)
        if is_trial is not None:
            try:
                from seahub_extra.trialaccount.models import TrialAccount
            except ImportError:
                pass
            else:
                if is_trial is True:
                    expire_date = timezone.now() + relativedelta(days=7)
                    TrialAccount.object.create_or_update(email, expire_date)
                else:
                    TrialAccount.objects.filter(user_or_org=email).delete()

    def put(self, request, email, format=None):

        # argument check for email
        if not is_valid_username(email):
            return api_error(status.HTTP_400_BAD_REQUEST,
                    'Email %s invalid.' % email)

        # argument check for name
        name = request.data.get("name", None)
        if name is not None:
            if len(name) > 64:
                return api_error(status.HTTP_400_BAD_REQUEST,
                        _('Name is too long (maximum is 64 characters)'))

            if "/" in name:
                return api_error(status.HTTP_400_BAD_REQUEST,
                        _("Name should not include '/'."))

        # argument check for list_in_address_book
        list_in_address_book = request.data.get("list_in_address_book", None)
        if list_in_address_book is not None:
            if list_in_address_book.lower() not in ('true', 'false'):
                return api_error(status.HTTP_400_BAD_REQUEST,
                        'list_in_address_book invalid')

        #argument check for loginid
        loginid = request.data.get("login_id", None)
        if loginid is not None:
            loginid = loginid.strip()
            if loginid == "":
                return api_error(status.HTTP_400_BAD_REQUEST,
                            _("Login id can't be empty"))
            usernamebyloginid = Profile.objects.get_username_by_login_id(loginid)
            if usernamebyloginid is not None:
                return api_error(status.HTTP_400_BAD_REQUEST,
                          _("Login id %s already exists." % loginid))

        # argument check for is_trial
        is_trial = request.data.get("is_trial", None)
        if is_trial is not None:
            try:
                is_trial = to_python_boolean(is_trial)
            except ValueError:
                return api_error(status.HTTP_400_BAD_REQUEST,
                        'is_trial invalid')

        try:
            # update account basic info
            user = User.objects.get(email=email)
            # argument check for is_staff
            is_staff = request.data.get("is_staff", None)
            if is_staff is not None:
                try:
                    is_staff = to_python_boolean(is_staff)
                except ValueError:
                    return api_error(status.HTTP_400_BAD_REQUEST,
                            'is_staff invalid.')

                user.is_staff = is_staff

            # argument check for is_active
            is_active = request.data.get("is_active", None)
            if is_active is not None:
                try:
                    is_active = to_python_boolean(is_active)
                except ValueError:
                    return api_error(status.HTTP_400_BAD_REQUEST,
                            'is_active invalid.')

                user.is_active = is_active
                if is_active == False:
                    # del tokens and personal repo api tokens (not group)
                    from seahub.utils import inactive_user
                    try:
                        inactive_user(email)
                    except Exception as e:
                        logger.error("Failed to inactive_user %s: %s." % (email, e))

            # update password
            password = request.data.get("password", None)
            if password is not None:
                user.set_password(password)

            # save user
            result_code = user.save()
            if result_code == -1:
                return api_error(status.HTTP_520_OPERATION_FAILED,
                                 'Failed to update user.')

            try:
                # update account additional info
                self._update_account_additional_info(request, email)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR,
                        'Internal Server Error')

            # get account info and return
            info = get_account_info(user)
            return Response(info)

        except User.DoesNotExist:
            # create user account
            copy = request.data.copy()
            copy['email'] = email
            serializer = AccountSerializer(data=copy)
            if not serializer.is_valid():
                return api_error(status.HTTP_400_BAD_REQUEST, serializer.errors)

            try:
                user = User.objects.create_user(serializer.data['email'],
                                                serializer.data['password'],
                                                serializer.data['is_staff'],
                                                serializer.data['is_active'])
            except User.DoesNotExist as e:
                logger.error(e)
                return api_error(status.HTTP_520_OPERATION_FAILED,
                                 'Failed to add user.')

            try:
                # update account additional info
                self._update_account_additional_info(request, email)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR,
                        'Internal Server Error')

            # get account info and return
            info = get_account_info(user)
            resp = Response(info, status=status.HTTP_201_CREATED)
            resp['Location'] = reverse('api2-account', args=[email])
            return resp

    def delete(self, request, email, format=None):
        if not is_valid_username(email):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Email %s invalid.' % email)

        # delete account
        try:
            user = User.objects.get(email=email)
            user.delete()
            return Response({'success': True})
        except User.DoesNotExist:
            resp = Response({'success': True}, status=status.HTTP_202_ACCEPTED)
            return resp
