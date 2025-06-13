# -*- coding: utf-8 -*-
import os
import sys
import logging
import urllib.request as urllib2

from django.conf import settings
from django.http import HttpResponseRedirect, Http404
from django.utils.encoding import smart_str

from seahub import auth
from seahub.auth import get_backends
from seahub.base.accounts import User
from seahub.profile.models import Profile
from seahub.auth.models import SocialAuthUser
from seahub.utils import render_error
from seahub.utils.ip import get_remote_ip
from seahub.project.models import IdInOrgTuple
from seahub.registration.models import notify_admins_on_activate_request
from .settings import TSH_AUTH_APP_ID, TSH_AUTH_APP_ID_MD5, TSH_AUTH_SEQ, \
     TSH_AUTH_REDIRECT_URI, TSH_AUTH_TICKET_CHECK_URI, TSH_AUTH_USERNAME_SUFFIX, \
     TSINGHUA_AUTH_ACTIVATE_USER_AFTER_CREATION

try:
    current_path = os.path.dirname(os.path.abspath(__file__))
    seatable_conf_dir = os.path.join(current_path, '../../../../../conf')
    sys.path.append(seatable_conf_dir)
    from seatable_custom_functions.tsinghua_custom import custom_get_user_role
    ENABLE_CUSTOM_GET_USER_ROLE = True
except ImportError:
    ENABLE_CUSTOM_GET_USER_ROLE = False

# Get an instance of a logger
logger = logging.getLogger(__name__)


def tsinghua_login(request):
    redirect = TSH_AUTH_REDIRECT_URI.format(
        AppIDMD5=TSH_AUTH_APP_ID_MD5, seq=TSH_AUTH_SEQ) + '?/tsinghua-auth/callback/'
    return HttpResponseRedirect(redirect)


def format_ticket_resp(resp):
    """
    Format check ticket url response `code=0:zjh=2011980001:yhm=lqx:xm=刘启新:yhlb=J0000:dw=计算中心:email=lqx@mail.com`
    Returns dict contains user attributes.
    """
    ret = {}
    splits = resp.split(':')
    for e in splits:
        k, v = e.split('=')
        ret[k] = v

    # converting raw string to unicode object
    xm = ret.get('xm', '')
    ret['xm'] = smart_str(xm)

    return ret


def tsinghua_auth_callback(request):
    """Called by tsinghua id server.
    e.g.  /tsinghua-auth/callback/?ticket=pm8EKA0Hpw2n01A26R2CPB9B5973VPDCDLVD

    server http request e.g.
    https://id.tsinghua.edu.cn/thuser/authapi/checkticket/ALL_ZHJW/pm8EKA0Hpw2n01A26R2CPB9B5973VPDCDLVD/166_111_5_193
    """
    ticket = request.GET.get('ticket', '')
    if not ticket:
        raise Http404

    ip = get_remote_ip(request)
    url = TSH_AUTH_TICKET_CHECK_URI.format(
        AppID=TSH_AUTH_APP_ID, ticket=ticket, ip=ip.replace('.', '_'))
    req = urllib2.Request(url)
    response = urllib2.urlopen(req)
    the_page = response.read().decode()
    logger.info(the_page)

    # 接口返回用户的信息，以 ”text/plain” 文本表示，格式形如：
    # code=0:zjh=2011980001:yhm=lqx:xm=刘启新:yhlb=J0000:dw=计算中心:email=lqx@mail.com
    # 其中用户的信息以冒号分隔：
    # code是返回值，0表示正常
    # zjh是用户的工作证号或学号
    # yhm是用户的网络账号
    # xm是用户的姓名
    # yhlb是用户类别，J0000/H0000/J0054是教师，X0011/X0021/X0031是学生
    resp_dict = format_ticket_resp(the_page)

    code = int(resp_dict['code'])
    if code != 0:
        logger.error('return code is not 0! ticket: %s' % ticket)
        return render_error(request, '登录失败，请稍后尝试。错误代码：001')

    zjh = resp_dict['zjh']
    if not zjh:
        logger.error('zjh is empty! ticket: %s' % ticket)
        return render_error(request, '登录失败，请稍后尝试。错误代码：002')

    xm = resp_dict['xm']
    if not xm:
        logger.error('xm is empty! ticket: %s' % ticket)

    # create and login user
    zjh = zjh.lower()
    tsinghua_user = SocialAuthUser.objects.get_by_provider_and_uid(TSH_AUTH_USERNAME_SUFFIX, zjh)
    if not tsinghua_user:
        # check user whether user already exists
        user = None
        id_in_org = IdInOrgTuple.objects.filter(org_id=-1, id_in_org=zjh).first()
        if id_in_org:
            username = id_in_org.virtual_id
            try:
                user = User.objects.get(username)
            except User.DoesNotExist:
                # If user not found, delete id_in_org and create a new user.
                IdInOrgTuple.objects.filter(org_id=-1, id_in_org=zjh).delete()
                logger.warning('Not found user, ID: %s' % zjh)
        if not user:
            try:
                if TSINGHUA_AUTH_ACTIVATE_USER_AFTER_CREATION:
                    user = User.objects.create_user(email='', is_active=True)
                else:
                    user = User.objects.create_user(email='', is_active=False)
                    notify_admins_on_activate_request(zjh)
            except Exception as e:
                logger.error(e)
                return render_error(request, '登录失败，请联系管理员。')
        tsinghua_user = SocialAuthUser.objects.add(user.username, TSH_AUTH_USERNAME_SUFFIX, zjh)
        if not tsinghua_user:
            return render_error(request, '登录失败，请联系管理员。')

    username = tsinghua_user.username
    try:
        user = User.objects.get(username)
    except User.DoesNotExist:
        try:
            logger.warning('The SocialAuthUser data is invalid, delete it and recreate one.')
            SocialAuthUser.objects.filter(provider=TSH_AUTH_USERNAME_SUFFIX, uid=zjh).delete()
            if TSINGHUA_AUTH_ACTIVATE_USER_AFTER_CREATION:
                user = User.objects.create_user(email='', is_active=True)
            else:
                user = User.objects.create_user(email='', is_active=False)
                notify_admins_on_activate_request(zjh)
            SocialAuthUser.objects.add(user.username, TSH_AUTH_USERNAME_SUFFIX, zjh)
        except Exception as e:
            logger.error('Recreate tsinghua user failed: %s.' % e)
            return render_error(request, '登录失败，请联系管理员。')

    u_p = Profile.objects.add_or_update(username=username, nickname=xm)
    contact_email = resp_dict['email']
    if contact_email:
        u_p.contact_email = contact_email
        u_p.save()
    unit = resp_dict.get('dw', None)
    if unit:
        u_p.unit = unit
        u_p.save()

    # update user's id_in_org
    IdInOrgTuple.objects.add_or_update(username, zjh, -1)

    # update user's role
    yhlb = resp_dict['yhlb']
    if yhlb:
        if ENABLE_CUSTOM_GET_USER_ROLE and callable(custom_get_user_role):
            role = custom_get_user_role(yhlb)
            if role:
                User.objects.update_role(username, role)
            else:
                User.objects.update_role(username, yhlb)
        else:
            User.objects.update_role(username, yhlb)

    if not user.is_active:
        return render_error(request, '您好，您目前没有系统使用权限。如有需要请联系管理员，联系电话：98570。')

    # login user
    for backend in get_backends():
        user.backend = "%s.%s" % (backend.__module__, backend.__class__.__name__)
    request.user = user
    auth.login(request, user)
    resp = HttpResponseRedirect(settings.SITE_ROOT)
    return resp
