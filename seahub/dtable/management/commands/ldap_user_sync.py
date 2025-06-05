# encoding: utf-8
import logging
import uuid
from datetime import datetime

from django.core.management.base import BaseCommand

from seaserv import ccnet_api

from seahub.utils import is_pro_version
from seahub.auth.models import SocialAuthUser
from seahub.base.accounts import User, ldap_role_mapping, ldap_role_list_mapping, USE_LDAP_ROLE_LIST_MAPPING
from seahub.profile.models import Profile
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.settings import LDAP_SAML_USE_SAME_UID, LDAP_USER_FIRST_NAME_ATTR, LDAP_USER_LAST_NAME_ATTR, \
     LDAP_USER_NAME_REVERSE, LDAP_CONTACT_EMAIL_ATTR, LDAP_EMPLOYEE_ID_ATTR, LDAP_USER_ROLE_ATTR, \
     ACTIVATE_USER_WHEN_IMPORT, ENABLE_SASL, SASL_MECHANISM, LDAP_USER_OBJECT_CLASS

try:
    import ldap
    import ldap.sasl
    from ldap.controls.libldap import SimplePagedResultsControl
    from seahub.settings import ENABLE_LDAP, LDAP_SERVER_URL, LDAP_BASE_DN, LDAP_ADMIN_DN, LDAP_ADMIN_PASSWORD, \
        LDAP_PROVIDER, LDAP_FILTER, LDAP_LOGIN_ATTR
except ImportError:
    ldap = None
    SimplePagedResultsControl = None
    ENABLE_LDAP = False
    LDAP_SERVER_URL = ''
    LDAP_BASE_DN = ''
    LDAP_ADMIN_DN = ''
    LDAP_ADMIN_PASSWORD = ''
    LDAP_PROVIDER = ''
    LDAP_FILTER = ''

try:
    from seahub.settings import LDAP_USER_UNIQUE_ID
except ImportError:
    LDAP_USER_UNIQUE_ID = ''

try:
    from seahub.settings import SAML_PROVIDER_IDENTIFIER
except ImportError:
    SAML_PROVIDER_IDENTIFIER = 'saml'


logger = logging.getLogger(__name__)


def parse_ldap_result(ldap_search_result):
    unique_id = ldap_search_result[1].get(LDAP_USER_UNIQUE_ID, b'')
    login_attr = ldap_search_result[1].get(LDAP_LOGIN_ATTR, '')
    first_name = ldap_search_result[1].get(LDAP_USER_FIRST_NAME_ATTR, '')
    last_name = ldap_search_result[1].get(LDAP_USER_LAST_NAME_ATTR, '')
    contact_email = ldap_search_result[1].get(LDAP_CONTACT_EMAIL_ATTR, '')
    id_in_org = ldap_search_result[1].get(LDAP_EMPLOYEE_ID_ATTR, '')
    user_role = ldap_search_result[1].get(LDAP_USER_ROLE_ATTR, '')

    if unique_id:
        try:
            unique_id = uuid.UUID(bytes=unique_id[0])
        except ValueError:
            unique_id = unique_id[0].decode()

    if login_attr:
        login_attr = login_attr[0].decode()

    if first_name:
        first_name = first_name[0].decode()
    if last_name:
        last_name = last_name[0].decode()

    if LDAP_USER_NAME_REVERSE:
        nickname = last_name + ' ' + first_name
    else:
        nickname = first_name + ' ' + last_name

    if contact_email:
        contact_email = contact_email[0].decode()

    if id_in_org:
        id_in_org = id_in_org[0].decode()

    if user_role:
        if not USE_LDAP_ROLE_LIST_MAPPING:
            role = user_role[0].decode()
            user_role = ldap_role_mapping(role)
        else:
            role_list = [role.decode() for role in user_role]
            user_role = ldap_role_list_mapping(role_list)

    return str(unique_id), login_attr, nickname, contact_email, id_in_org, user_role


class Command(BaseCommand):
    help = 'ldap user sync'
    label = "ldap_user_sync"

    def handle(self, *args, **options):
        if not is_pro_version() or not ENABLE_LDAP:
            logger.debug('ldap not enabled')
            return

        logger.debug('Start ldap user sync...')
        self.stdout.write('[%s] Start ldap user sync...\n' % datetime.now())

        try:
            self.do_action()
        except Exception as e:
            logger.error(f'ldap user sync failed {e}')

        self.stdout.write('[%s] Finish ldap user sync.\n' % datetime.now())
        logger.debug('Finish ldap user sync.')

    def do_action(self):
        con = ldap.initialize(LDAP_SERVER_URL)

        try:
            con.set_option(ldap.OPT_REFERRALS, 0)
        except Exception as e:
            logger.error(f'Failed to set referrals option. {e}')
            return

        try:
            con.protocol_version = ldap.VERSION3
            if ENABLE_SASL and SASL_MECHANISM:
                sasl_cb_value_dict = {}
                if SASL_MECHANISM != 'EXTERNAL' and SASL_MECHANISM != 'GSSAPI':
                    sasl_cb_value_dict = {
                        ldap.sasl.CB_AUTHNAME: LDAP_ADMIN_DN,
                        ldap.sasl.CB_PASS: LDAP_ADMIN_PASSWORD,
                    }
                sasl_auth = ldap.sasl.sasl(sasl_cb_value_dict, SASL_MECHANISM)
                con.sasl_interactive_bind_s('', sasl_auth)
            else:
                con.simple_bind_s(LDAP_ADMIN_DN, LDAP_ADMIN_PASSWORD)
        except Exception as e:
            logger.error(f'ldap admin bind failed. {e}')
            return

        ctrl = SimplePagedResultsControl(True, size=100, cookie='')
        result_data_list = []
        filterstr = None
        if LDAP_FILTER:
            filterstr = f'(&(objectClass={LDAP_USER_OBJECT_CLASS})({LDAP_FILTER}))'
        else:
            filterstr = f'(objectClass={LDAP_USER_OBJECT_CLASS})'

        while True:
            try:
                res = con.search_ext(
                    LDAP_BASE_DN, ldap.SCOPE_SUBTREE, filterstr=filterstr, serverctrls=[ctrl])
                rtype, rdata, rmsgid, ctrls = con.result3(res)
            except ldap.LDAPError as e:
                logger.error('Search failed for base dn(%s), filter(%s) on server %s, error: %s'
                             % (LDAP_BASE_DN, filterstr, LDAP_SERVER_URL, e))
                return None

            result_data_list.extend(rdata)
            page_ctrls = [c for c in ctrls if c.controlType == SimplePagedResultsControl.controlType]
            if not page_ctrls or not page_ctrls[0].cookie:
                break
            ctrl.cookie = page_ctrls[0].cookie
        con.unbind_s()

        unique_id_set = set()
        unique_id_list_in_ldap = dict()
        for data in result_data_list:
            try:
                unique_id, login_attr, nickname, contact_email, id_in_org, user_role = parse_ldap_result(data)
                unique_id_list_in_ldap[login_attr] = (login_attr, nickname, contact_email, id_in_org, user_role)
                unique_id_list_in_ldap[unique_id] = (login_attr, nickname, contact_email, id_in_org, user_role)
                unique_id_set.add(unique_id)
            except Exception as e:
                logger.exception(e)

        ldap_users_from_db = SocialAuthUser.objects.filter(provider=LDAP_PROVIDER)
        ldap_uid_set = set()
        for user in ldap_users_from_db:
            ldap_uid_set.add(user.uid)

        saml_uid_set = set()
        if LDAP_SAML_USE_SAME_UID:
            saml_users_from_db = SocialAuthUser.objects.filter(provider=SAML_PROVIDER_IDENTIFIER)
            for user in saml_users_from_db:
                saml_uid_set.add(user.uid)

        # if db_user not in ldap_user_list, means user is deleted in ldap server
        # then we set is_active=False in SeaTable.
        for db_user in ldap_users_from_db:
            if db_user.uid not in unique_id_list_in_ldap:
                try:
                    user = User.objects.get(email=db_user.username)
                except User.DoesNotExist:
                    continue
                user.is_active = False
                if user.save() != 0:
                    continue

                # del tokens and personal repo api tokens (not group)
                from seahub.utils import inactive_user
                try:
                    inactive_user(user.username)
                except Exception as e:
                    logger.error("Failed to inactive_user %s: %s." % (user.username, e))

                logger.debug(f'User {email2nickname(db_user.username)} is deleted in LDAP server, disable it.')
            else:
                # add saml user
                if LDAP_SAML_USE_SAME_UID and db_user.uid not in saml_uid_set:
                    SocialAuthUser.objects.add(db_user.username, SAML_PROVIDER_IDENTIFIER, db_user.uid)

                # update ldap user's info
                (login_attr, nickname, contact_email, id_in_org, user_role) = unique_id_list_in_ldap[db_user.uid]

                if not ldap_users_from_db.filter(uid=login_attr).exists():
                    SocialAuthUser.objects.add(db_user.username, LDAP_PROVIDER, login_attr)
                if LDAP_SAML_USE_SAME_UID and not saml_users_from_db.filter(uid=login_attr).exists():
                    SocialAuthUser.objects.add(db_user.username, SAML_PROVIDER_IDENTIFIER, login_attr)
                ldap_uid_set.add(login_attr)

                try:
                    profile_kwargs = {'nickname': nickname}
                    p = Profile.objects.get_profile_by_user(db_user.username)
                    if not (p and p.is_manually_set_contact_email):
                        profile_kwargs['contact_email'] = contact_email
                    Profile.objects.add_or_update(db_user.username, **profile_kwargs)

                    org_id = -1
                    orgs = ccnet_api.get_orgs_by_user(db_user.username)
                    if orgs:
                        org_id = orgs[0].org_id
                    if id_in_org:
                        from seahub.dtable.models import IdInOrgTuple
                        IdInOrgTuple.objects.add_or_update(db_user.username, id_in_org, org_id)

                    if user_role:
                        User.objects.update_role(db_user.username, user_role)
                except Exception as e:
                    logger.error(f'update ldap user failed {e}')

        for ldap_uid in unique_id_list_in_ldap.keys():
            if ldap_uid not in ldap_uid_set:
                if ldap_uid in unique_id_set:
                    # do not create ldap user with ldap_uid
                    continue
                # create ldap user with login_attr
                try:
                    (login_attr, nickname, contact_email, id_in_org, user_role) = unique_id_list_in_ldap[ldap_uid]
                    user = User.objects.create_ldap_user(
                        email=contact_email, nickname=nickname, is_active=ACTIVATE_USER_WHEN_IMPORT)
                    SocialAuthUser.objects.add(user.username, LDAP_PROVIDER, login_attr)
                    if LDAP_SAML_USE_SAME_UID and ldap_uid not in saml_uid_set:
                        SocialAuthUser.objects.add(user.username, SAML_PROVIDER_IDENTIFIER, login_attr)
                except Exception as e:
                    logger.error(f'create ldap user failed. {e}')
