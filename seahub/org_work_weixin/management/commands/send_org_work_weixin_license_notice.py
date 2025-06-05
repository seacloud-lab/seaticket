import json
import time
import logging
import requests
from datetime import datetime, timedelta


from django.core.management.base import BaseCommand
from seahub.organizations.models import OrgCorpAuth
from seahub.notifications.models import SysUserNotification
from seahub.auth.models import SocialAuthUser
from seahub.org_work_weixin.settings import ORG_WORK_WEIXIN_PROVIDER
from seahub.org_work_weixin.utils import get_org_subscription, get_app_license_info

# Get an instance of a logger
logger = logging.getLogger(__name__)


class CommandLogMixin(object):
    def println(self, msg):
        self.stdout.write('[%s] %s\n' % (str(datetime.now()), msg))

    def log_error(self, msg):
        logger.error(msg)
        self.println(msg)

    def log_warning(self, msg):
        logger.warning(msg)
        self.println(msg)

    def log_info(self, msg):
        logger.info(msg)
        self.println(msg)

    def log_debug(self, msg):
        logger.debug(msg)
        self.println(msg)


#######################################


class Command(BaseCommand, CommandLogMixin):
    """ Send org-work-weixin-license notifications for free team.
    """

    help = 'Send org-work-weixin-license notifications for free team.'

    def handle(self, *args, **options):
        self.log_debug('Start checking org-work-weixin-license...')
        self.do_action()
        self.log_debug('Finish checking org-work-weixin-license.\n')

    def do_action(self):
        now = int(time.time())
        one_day = 24 * 3600
        days_1 = now + 1 * one_day
        days_3 = now + 3 * one_day
        days_7 = now + 7 * one_day

        org_corps = OrgCorpAuth.objects.exclude(permanent_code='')
        
        for org_corp in org_corps:
            if not org_corp.org_id or not org_corp.corp_id:
                continue

            time.sleep(0.5)
            try:
                subscription = get_org_subscription(org_corp.org_id)
                if subscription:
                    is_active = subscription.get('is_active')
                    if is_active:
                        continue

                # https://developer.work.weixin.qq.com/document/path/95844
                app_license_info = get_app_license_info(org_corp.corp_id)
                license_status = app_license_info.get('license_status')
                if license_status == 0:
                    continue
                trial_end_time = app_license_info.get('trail_info', {}).get('end_time')
                if not trial_end_time:
                    continue
                if days_1 - one_day < trial_end_time < days_1:
                    day_str = '1'
                elif days_3 - one_day < trial_end_time < days_3:
                    day_str = '3'
                elif days_7 - one_day < trial_end_time < days_7:
                    day_str = '7'
                else:
                    continue

                exist_users = SocialAuthUser.objects.filter(
                    provider=ORG_WORK_WEIXIN_PROVIDER, uid__contains=org_corp.corp_id)

                for user in exist_users:
                    msg = '企业微信接口许可试用期仅剩 ' + day_str + \
                        ' 天，请购买团队付费版以持续使用企业微信接口。请绑定手机号或邮箱，以防企业微信接口许可过期无法登录账号。'
                    notification = SysUserNotification.objects.create_sys_user_notificatioin(
                        msg, user.username)
                    self.log_info('Notify User: ' + user.username + ' days: ' + day_str)
            except Exception as e:
                self.log_warning(e)
        return
