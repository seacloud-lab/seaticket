# Copyright (c) 2012-2016 Seafile Ltd.
import re

from django.core.cache import cache
from django.conf import settings
from django.urls import reverse
from django.http import HttpResponseRedirect, HttpResponseForbidden
from django.utils import translation
from django.utils.deprecation import MiddlewareMixin


from seahub.api2.utils import to_python_boolean
from seahub.auth.models import AnonymousUser
from seahub.constants import DEFAULT_ADMIN
from seahub.profile.models import Profile
from seahub.organizations.models import Organization

try:
    from seahub.settings import MULTI_TENANCY
except ImportError:
    MULTI_TENANCY = False
from seahub.settings import SITE_ROOT

class BaseMiddleware(MiddlewareMixin):
    """
    Middleware that add organization, group info to user.
    """

    def process_request(self, request):
        username = request.user.username
        request.user.org = None

        lang = None
        if not isinstance(request.user, AnonymousUser):
            if MULTI_TENANCY:
                sql = """SELECT a.org_id, org_name, url_prefix, is_staff FROM organization_organization a 
                                INNER JOIN org_user b ON a.org_id=b.org_id WHERE b.email=%s"""
                org = Organization.objects.raw(sql, (username,))
                if org:
                    request.user.org = org[0]
                    from seahub.organizations.models import OrgSettings
                    request.user.role = OrgSettings.objects.get_role_by_org(request.user.org)
            lang = Profile.objects.get_user_language(request.user.username)
        else:
            # request cookies
            if request.COOKIES.get(settings.LANGUAGE_COOKIE_NAME):
                lang = request.COOKIES[settings.LANGUAGE_COOKIE_NAME]
            else:
                lang = getattr(settings, 'FORCE_DEFAULT_LANGUAGE')
        if lang:
            translation.activate(lang)
        return None

    def process_response(self, request, response):
        return response


class ForcePasswdChangeMiddleware(MiddlewareMixin):
    def _request_in_black_list(self, request):
        path = request.path
        black_list = (r'^%s$' % SITE_ROOT, r'home/.+', r'repo/.+',
                      r'[f|d]/[a-f][0-9]+', r'group/\d+', r'groups/',
                      r'share/', r'profile/', r'notification/list/')

        for patt in black_list:
            if re.search(patt, path) is not None:
                return True
        return False

    def process_request(self, request):
        if request.session.get('force_passwd_change', False):
            if self._request_in_black_list(request):
                return HttpResponseRedirect(reverse('auth_password_change'))


class UserPermissionMiddleware(MiddlewareMixin):

    def process_request(self, request):

        user = request.user
        if not user.is_authenticated or \
                not user.is_staff or \
                not hasattr(user, 'admin_role'):
            return None

        role = user.admin_role
        if not role or role == DEFAULT_ADMIN:
            return None

        permission_url = {
            'can_view_system_info': [
                'api/v1/admin/sysinfo',
            ],
            'can_view_statistic': [
                'sys/statistic/file',
                'sys/statistic/storage',
                'sys/statistic/user',
                'sys/trafficadmin',
                'api/v1/admin/statistics',
            ],
            'can_config_system': [
                'sys/settings',
                'api/v1/admin/logo',
                'api/v1/admin/favicon',
                'api/v1/admin/login-background-image',
            ],
            'can_manage_user': [
                'sys/users',
                'sys/users/export-excel',
                'sys/users/ldap',
                'sys/users/ldap/imported',
                'sys/users/admins',
                'users/add',
                'users/remove',
                'users/removetrial',
                'users/search',
                'users/removeadmin',
                'users/info',
                'users/toggle_status',
                'users/toggle_role',
                'users', # for 'users/(?P<email>[^/]+)/set_quota',
                'users/password/reset',
                'users/batchmakeadmin',
                'users/batchadduser',
                'api/v1/admin/users/batch',
            ],
            'can_manage_group': [
                'sys/groups/export-excel',
                'api/v1/admin/groups',
            ],
            'can_view_user_log': [
                'sys/loginadmin',
                'sys/loginadmin/export-excel',
                'sys/log/fileaudit',
                'sys/log/emailaudit',
                'sys/log/fileaudit/export-excel',
                'sys/log/fileupdate',
                'sys/log/fileupdate/export-excel',
                'sys/log/permaudit',
                'sys/log/permaudit/export-excel',
                'api/v1/admin/logs/login',
                'api/v1/admin/logs/file-audit',
                'api/v1/admin/logs/file-update',
                'api/v1/admin/logs/perm-audit',
            ],
            'can_view_admin_log': [
                'api/v1/admin/admin-logs',
                'api/v1/admin/admin-login-logs',
            ],
        }

        request_path = request.path
        def get_permission_by_request_path(request_path, permission_url):
            for permission, url_list in permission_url.items():
                for url in url_list:
                    if url in request_path:
                        return permission

        permission = get_permission_by_request_path(request_path,
                permission_url)

        if permission == 'can_view_system_info':
            if not request.user.admin_permissions.can_view_system_info():
                return HttpResponseForbidden()
        elif permission == 'can_view_statistic':
            if not request.user.admin_permissions.can_view_statistic():
                return HttpResponseForbidden()
        elif permission == 'can_config_system':
            if not request.user.admin_permissions.can_config_system():
                return HttpResponseForbidden()
                return HttpResponseForbidden()
        elif permission == 'can_manage_user':
            if not request.user.admin_permissions.can_manage_user():
                return HttpResponseForbidden()
        elif permission == 'can_manage_group':
            if not request.user.admin_permissions.can_manage_group():
                return HttpResponseForbidden()
        elif permission == 'can_view_user_log':
            if not request.user.admin_permissions.can_view_user_log():
                return HttpResponseForbidden()
        elif permission == 'can_view_admin_log':
            if not request.user.admin_permissions.can_view_admin_log():
                return HttpResponseForbidden()
        else:
            return None


class UserAgentMiddleWare(MiddlewareMixin):
    user_agents_test_match = (
        "w3c ", "acs-", "alav", "alca", "amoi", "audi",
        "avan", "benq", "bird", "blac", "blaz", "brew",
        "cell", "cldc", "cmd-", "dang", "doco", "eric",
        "hipt", "inno", "ipaq", "java", "jigs", "kddi",
        "keji", "leno", "lg-c", "lg-d", "lg-g", "lge-",
        "maui", "maxo", "midp", "mits", "mmef", "mobi",
        "mot-", "moto", "mwbp", "nec-", "newt", "noki",
        "xda",  "palm", "pana", "pant", "phil", "play",
        "port", "prox", "qwap", "sage", "sams", "sany",
        "sch-", "sec-", "send", "seri", "sgh-", "shar",
        "sie-", "siem", "smal", "smar", "sony", "sph-",
        "symb", "t-mo", "teli", "tim-", "tosh", "tsm-",
        "upg1", "upsi", "vk-v", "voda", "wap-", "wapa",
        "wapi", "wapp", "wapr", "webc", "winw", "xda-",)
    user_agents_test_search = u"(?:%s)" % u'|'.join((
        'up.browser', 'up.link', 'mmp', 'symbian', 'smartphone', 'midp',
        'wap', 'phone', 'windows ce', 'pda', 'mobile', 'mini', 'palm',
        'netfront', 'opera mobi',
    ))
    user_agents_exception_search = u"(?:%s)" % u'|'.join((
        'ipad',
    ))
    http_accept_regex = re.compile("application/vnd\.wap\.xhtml\+xml", re.IGNORECASE)
    user_agents_android_search = u"(?:android)"
    user_agents_mobile_search = u"(?:mobile)"
    user_agents_tablets_search = u"(?:%s)" % u'|'.join(('ipad', 'tablet', ))

    def __init__(self, get_response=None):
        self.get_response = get_response

        # these for detect mobile
        user_agents_test_match = r'^(?:%s)' % '|'.join(self.user_agents_test_match)
        self.user_agents_test_match_regex = re.compile(user_agents_test_match, re.IGNORECASE)
        self.user_agents_test_search_regex = re.compile(self.user_agents_test_search, re.IGNORECASE)
        self.user_agents_exception_search_regex = re.compile(self.user_agents_exception_search, re.IGNORECASE)

        # these three used to detect tablet
        self.user_agents_android_search_regex = re.compile(self.user_agents_android_search, re.IGNORECASE)
        self.user_agents_mobile_search_regex = re.compile(self.user_agents_mobile_search, re.IGNORECASE)
        self.user_agents_tablets_search_regex = re.compile(self.user_agents_tablets_search, re.IGNORECASE)

    def process_request(self, request):
        is_mobile = False
        is_tablet = False

        # URL search includes the mobile-view field, it will overwrite the HTTP_USER_AGENT
        mobile_view = request.GET.get('mobile-view')
        if mobile_view:
            try:
                if to_python_boolean(mobile_view):
                    request.is_mobile = True
                    request.is_tablet = True
                    return
            except:
                pass

        if 'HTTP_USER_AGENT' in request.META:
            user_agent = request.META['HTTP_USER_AGENT']

            # Test common mobile values.
            if self.user_agents_test_search_regex.search(user_agent) and \
                not self.user_agents_exception_search_regex.search(user_agent):
                is_mobile = True
            else:
                # Nokia like test for WAP browsers.
                # http://www.developershome.com/wap/xhtmlmp/xhtml_mp_tutorial.asp?page=mimeTypesFileExtension

                if 'HTTP_ACCEPT' in request.META:
                    http_accept = request.META['HTTP_ACCEPT']
                    if self.http_accept_regex.search(http_accept):
                        is_mobile = True

            if not is_mobile:
                # Now we test the user_agent from a big list.
                if self.user_agents_test_match_regex.match(user_agent):
                    is_mobile = True

            # Ipad or Blackberry
            if self.user_agents_tablets_search_regex.search(user_agent):
                is_tablet = True
            # Android-device. If User-Agent doesn't contain Mobile, then it's a tablet
            elif (self.user_agents_android_search_regex.search(user_agent) and
                  not self.user_agents_mobile_search_regex.search(user_agent)):
                is_tablet = True

        request.is_mobile = is_mobile
        request.is_tablet = is_tablet


class SqlPrintMiddleware(MiddlewareMixin):
    """Output the sql used in the view.
    """
    def process_response(self, request, response):
        """Output all the sql queries for the Django orm.
        """
        from django.db import connection
        import textwrap
        should_run = getattr(settings, 'SQLPRINT_MIDDLEWARE', True)
        if not should_run:
            return response
        x_db_hits = getattr(settings, 'X_DB_HITS', True)
        runnable = settings.DEBUG or settings.TESTING
        max_queries = getattr(settings, 'SQLPRINT_MAX_QUERIES', 1200)
        min_queries = getattr(settings, 'SQLPRINT_MIN_QUERIES', 0)

        queries = connection.queries
        dbhits = len(queries)
        if runnable and x_db_hits:
            response['X-DB-hits'] = str(dbhits)

        if runnable:
            if dbhits > min_queries:
                self.print_queries(request, queries)

            if max_queries and dbhits > max_queries:
                raise RuntimeError(textwrap.dedent("""\
                    A single request caused {dbhits} db hits, which is more than
                    settings.SQLPRINT_MAX_QUERIES
                    """.format(dbhits=dbhits)))

        return response

    def print_queries(self, request, queries):
        """Output all the queries.
        """
        from pygments import highlight, lexers, formatters
        from pygments_pprint_sql import SqlFilter

        lexer = lexers.MySqlLexer()
        lexer.add_filter(SqlFilter())

        totsecs = 0.0
        for query in queries:

            print(query['time'], 'used on:')
            totsecs += float(query['time'])
            print(highlight(query['sql'], lexer, formatters.TerminalFormatter()))

        print('Number of queries:', len(queries))
        print('Total time:', totsecs)
