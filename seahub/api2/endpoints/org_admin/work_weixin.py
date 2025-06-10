# Copyright (c) 2012-2020 Seafile Ltd.
# encoding: utf-8

import logging
import json
import time
import requests
from datetime import datetime

from django.utils.translation import gettext as _
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.utils import api_error
from seahub.base.accounts import User
from seahub.auth.models import SocialAuthUser
from seahub.profile.models import Profile
from seahub.organizations.settings import ORG_MEMBER_QUOTA_ENABLED
from seahub.organizations.models import OrgMemberQuota
from seahub.invitations.utils import record_registration_logs
from seahub.organizations.models import OrgCorpAuth
from seahub.org_work_weixin.utils import org_work_weixin_check, get_agent_config, \
    get_corp_info, list_all_members, get_org_subscription, get_app_license_info, \
    list_corp_orders, list_corp_license_actived_account, get_provider_access_token

logger = logging.getLogger(__name__)


class OrgAdminWorkWeixinInfo(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

    def get(self, request, org_id):
        if not org_work_weixin_check():
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            user_limit = 0
            can_create_order = False
            subscription = get_org_subscription(org_id)
            if subscription:
                user_limit = subscription.get('user_limit')
                can_create_order = subscription.get('is_active')

            org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
            if not org_corp or not org_corp.permanent_code:
                error_msg = '该企业未添加 SeaTable 应用'
                err = {
                    'error_msg': error_msg,
                    'can_create_order': can_create_order,
                }
                return Response(err, status=status.HTTP_404_NOT_FOUND)

            # member quota
            if ORG_MEMBER_QUOTA_ENABLED:
                member_quota = OrgMemberQuota.objects.get_quota(org_id)
            else:
                member_quota = None

            info = org_corp.to_dict()
            # subscription
            info['user_limit'] = user_limit
            info['can_create_order'] = can_create_order
            info['member_quota'] = member_quota

            # orders
            info['unpaid_account_count'] = 0
            info['unactived_account_count'] = 0
            info['order_count'] = 0
            if info['can_create_order']:
                orders = list_corp_orders(org_corp.corp_id)
                info['order_count'] = len(orders)
                for order in orders:
                    order_status = order.get('order_status')  # 0：待支付，1：已支付，2：未支付，订单已关闭，3：未支付，订单已过期，4：申请退款中，5：退款成功，6：退款被拒绝
                    order_type = order.get('order_type')  # 1：购买帐号，2：续期帐号 5:历史企业迁移订单
                    count = order.get('base_count')  # 下单数量
                    actived_count = order.get('actived_count')  # 激活码已使用的数量
                    if order_status == 0:
                        info['unpaid_account_count'] += count
                    if order_status == 1 and order_type == 1 and\
                            actived_count < count:
                        info['unactived_account_count'] += (count - actived_count)

            # account_list
            info['actived_account_count'] = 0
            now = int(time.time())
            if info['can_create_order']:
                license_actived_account = list_corp_license_actived_account(org_corp.corp_id)
                account_list = license_actived_account.get('account_list')
                account_userid_list = []
                for account in account_list:
                    if account.get('expire_time', 0) > now and \
                            account.get('userid') not in account_userid_list:
                        info['actived_account_count'] += 1
                        account_userid_list.append(account.get('userid'))

            # app_license_info
            info['trial_end_time'] = ''
            app_license_info = get_app_license_info(org_corp.corp_id)
            license_status = app_license_info.get('license_status')
            if license_status == 0:
                info['trial_end_time'] = '2022-10-8'
            else:
                trial_end_time = app_license_info.get('trail_info', {}).get('end_time')
                if trial_end_time:
                    info['trial_end_time'] = datetime.fromtimestamp(trial_end_time).strftime('%Y-%m-%d')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'corp': info})


class OrgAdminWorkWeixinUsers(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdminUser,)

    def get(self, request, org_id):
        """ list users in work weixin
        """
        if not org_work_weixin_check():
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
            if not org_corp or not org_corp.permanent_code:
                error_msg = '该企业未添加 SeaTable 应用'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            corp_info = get_corp_info(org_corp.corp_id, org_corp.permanent_code)
            privilege = corp_info['auth_info']['agent'][0]['privilege']
            allow_party = privilege['allow_party']
            allow_user = privilege['allow_user']

            user_list = list_all_members(org_corp, allow_party, allow_user)
            department_count = len(allow_party)
            user_count = len(user_list)

            # agent_config
            agent_config = get_agent_config(org_corp)

            return Response({
                'user_list': user_list,
                'department_count': department_count,
                'user_count': user_count,
                'agent_config': agent_config,
            })
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    def post(self, request, org_id):
        """ import work-weixin user
        """
        from seahub.org_work_weixin.settings import ORG_WORK_WEIXIN_PROVIDER
        if not org_work_weixin_check():
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org = request.user.org
        org_id = int(org_id)
        work_weixin_user = request.data.get('user', {})
        user_id = work_weixin_user.get('user_id')
        if not work_weixin_user or not user_id or work_weixin_user.get('username'):
            error_msg = 'user invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if ORG_MEMBER_QUOTA_ENABLED:
            org_members = ccnet_api.get_org_users_by_url_prefix(org.url_prefix, -1, -1)
            org_active_members = len([m for m in org_members if m.is_active])
            org_members_quota = OrgMemberQuota.objects.get_quota(org_id)
            if org_members_quota is not None and org_active_members >= org_members_quota:
                error_msg = '用户数已超'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
            if not org_corp or not org_corp.permanent_code:
                error_msg = '该企业未添加 SeaTable 应用'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            corp_id = org_corp.corp_id
            uid = corp_id + '_' + user_id
            if SocialAuthUser.objects.filter(provider=ORG_WORK_WEIXIN_PROVIDER, uid=uid).exists():
                error_msg = 'user already exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                user = User.objects.create_oauth_user(is_active=True)
            except User.DoesNotExist as e:
                logger.error(e)
                error_msg = 'Fail to add user.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            # bind
            ccnet_api.add_org_user(org_id, user.username, int(False))
            nickname = '新用户-' + user_id[-2:]
            try:
                Profile.objects.add_or_update(user.username, nickname=nickname)
            except Exception as e:
                logger.warning(e)
            SocialAuthUser.objects.add(
                user.username, ORG_WORK_WEIXIN_PROVIDER, uid)

            try:
                record_registration_logs(user, 'org-admin-add')
            except Exception as e:
                logger.warning('Failed to record registration log, error: %s' % e)

            user_info = work_weixin_user
            user_info['username'] = user.username
            user_info['name'] = nickname
            return Response({'user': user_info})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class OrgAdminWorkWeixinUser(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdminUser,)

    def delete(self, request, org_id):
        """ disconnect work-weixin user
        """
        from seahub.org_work_weixin.settings import ORG_WORK_WEIXIN_PROVIDER
        if not org_work_weixin_check():
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org_id = int(org_id)
        work_weixin_user = request.data.get('user')
        user_id = work_weixin_user.get('user_id')
        username = work_weixin_user.get('username')
        if not work_weixin_user or not user_id or not username:
            error_msg = 'user invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            err_msg = 'User %s not found.' % username
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        # permission check
        if not ccnet_api.org_user_exists(org_id, username):
            err_msg = _('User %s not found in organization.') % username
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        try:
            org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
            if not org_corp or not org_corp.permanent_code:
                error_msg = '该企业未添加 SeaTable 应用'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            SocialAuthUser.objects.delete_by_username_and_provider(
                username=username, provider=ORG_WORK_WEIXIN_PROVIDER)
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class OrgAdminWorkWeixinCreateLicenseOrder(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdminUser,)

    def post(self, request, org_id):
        from seahub.subscription.settings import SUBSCRIPTION_SERVER_URL
        from seahub.subscription.utils import get_subscription_api_headers

        if not org_work_weixin_check():
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        count = request.data.get('count')
        try:
            count = int(count)
        except ValueError:
            error_msg = 'count invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if count < 1 or count > 10000:
            error_msg = 'count invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
            if not org_corp or not org_corp.permanent_code:
                error_msg = '该企业未添加 SeaTable 应用'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            headers = get_subscription_api_headers()
            data={
                'org_id': org_id,
                'corp_id': org_corp.corp_id,
                'corp_name': org_corp.corp_name,
                'base_count': count,
                'provider_access_token': get_provider_access_token(),
            }
            url = SUBSCRIPTION_SERVER_URL.rstrip('/') + '/api/org-work-weixin-license/org-admin-create-order/'
            response = requests.post(url, json=data, headers=headers)

            return Response(response.json(), status=response.status_code)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
