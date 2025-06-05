import logging

from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class UserLoginLogManager(models.Manager):
    def create_login_log(self, username, login_ip, login_success=True):
        try:
            l = super(UserLoginLogManager, self).create(username=username,
                                                        login_ip=login_ip, login_success=login_success)
            l.save()
            return l
        except Exception as e:
            if e.args and e.args[0] == 1366:  # Incorrect string value xxx for column xxx
                logger.warning('create login log username: %s login ip: %s login_success: %s error: %s', username, login_ip, login_success, e)
            else:
                logger.error('create login log username: %s login ip: %s login_success: %s error: %s', username, login_ip, login_success, e)
            return None


class UserLoginLog(models.Model):
    username = models.CharField(max_length=255, db_index=True)
    login_date = models.DateTimeField(default=timezone.now, db_index=True)
    login_ip = models.CharField(max_length=128)
    login_success = models.BooleanField(default=True)

    objects = UserLoginLogManager()

    class Meta:
        ordering = ['-login_date']


from django.dispatch import receiver
from seahub.auth.signals import user_logged_in, user_logged_in_failed
from seahub.utils.ip import get_remote_ip
from seahub.registration.signals import user_deleted


@receiver(user_logged_in)
def create_login_log(sender, request, user, **kwargs):
    username = user.username
    login_ip = get_remote_ip(request)
    UserLoginLog.objects.create_login_log(username, login_ip)


@receiver(user_logged_in_failed)
def create_login_failed_log(sender, request, **kwargs):
    username = request.POST.get('login', '')
    login_ip = get_remote_ip(request)
    UserLoginLog.objects.create_login_log(username, login_ip, login_success=False)


@receiver(user_deleted)
def remove_login_log(sender, username, **kwargs):
    UserLoginLog.objects.filter(username=username).delete()
