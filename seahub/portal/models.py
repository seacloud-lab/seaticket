import json
import string
import random
import copy
from types import SimpleNamespace
from uuid import uuid4
from secrets import token_hex

from django.db import models
from django.db import IntegrityError
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from django.urls import reverse
from copy import deepcopy

from seahub.project.constants import PORTAL_ISSUES_DEFAULT_DETAILS
from seahub.utils import get_no_duplicate_obj_name, get_service_url, uuid_str_to_32_chars
from seahub.portal.custom_domain import CUSTOM_DOMAIN_TXT_RECORD_PREFIX, CUSTOM_DOMAIN_VERIFICATION_VALUE_PREFIX, \
    get_portal_subdomain_prefix, normalize_portal_custom_domain, get_portal_reserved_subdomain_prefixes, \
    normalize_portal_subdomain_prefix
from seahub.seadb_models.models import SchemaTables


PORTAL_DOMAIN_CACHE_TIMEOUT = 300
PORTAL_CUSTOM_DOMAIN_CACHE_FIELDS = ('domain', 'project_uuid', 'verified')
PORTAL_DOMAIN_ALIAS_CACHE_FIELDS = ('prefix', 'project_uuid')

PORTAL_TLS_ASK_CACHE_TIMEOUT = 60
PORTAL_TLS_ASK_CACHE_PREFIX = 'portal_tls_ask_allowed:'

PORTAL_DOMAIN_CACHE_MISS_VALUE = '__portal_domain_cache_miss__'
PORTAL_DOMAIN_CACHE_MISS_TIMEOUT = 60


def get_portal_tls_ask_cache_key(domain):
    return '%s%s' % (PORTAL_TLS_ASK_CACHE_PREFIX, domain)


def generate_random_string_lower_digits(length):
    letters_and_digits = string.ascii_lowercase + string.digits
    random_string = ''.join(random.choice(letters_and_digits) for i in range(length))
    return random_string


def generate_views_unique_id(length, folders_views_ids=None):
    if not folders_views_ids:
        return generate_random_string_lower_digits(length)

    while True:
        id = generate_random_string_lower_digits(length)
        if id not in folders_views_ids:
            break

    return id

class PortalExternalInvitationManager(models.Manager):

    def add(self, inviter, email, project_uuid, expire_hours=72):
        token = uuid4().hex
        expire_time = timezone.now() + timezone.timedelta(hours=int(expire_hours))
        obj = self.model(token=token, inviter=inviter, email=email, project_uuid=project_uuid, expire_time=expire_time)
        obj.save(using=self._db)
        return obj

    def list_invites_by_project_uuid(self, project_uuid):
        return super().filter(project_uuid=project_uuid).order_by('-created_at')

    def get_by_token(self, token):
        return super().filter(token=token).first()


class PortalExternalInvitation(models.Model):
    token = models.CharField(max_length=40, unique=True)
    inviter = models.CharField(max_length=255)
    email = models.CharField(max_length=255)
    project_uuid = models.CharField(max_length=36, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expire_time = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    objects = PortalExternalInvitationManager()

    class Meta:
        db_table = 'portal_external_invitations'

    def is_expired(self):
        return timezone.now() >= self.expire_time

    def get_link(self, request):
        path = '/external/accept/%s/' % self.token
        custom_domain = PortalCustomDomain.objects.get_verified_by_project_uuid(self.project_uuid)
        if custom_domain:
            return '%s://%s%s' % (request.scheme, custom_domain.domain, path)

        alias = PortalDomainAlias.objects.get_by_project_uuid(self.project_uuid)
        root_domain = getattr(settings, 'PORTAL_SERVICE_ROOT_DOMAIN', '')
        if alias and root_domain:
            domain = '%s.%s' % (alias.prefix, root_domain)
            return '%s://%s%s' % (request.scheme, domain, path)

        base = get_service_url().rstrip('/')
        fallback_path = reverse('portal_external_invitation_accept_view', args=(self.token, self.project_uuid))
        return f"{base}{fallback_path}" if base else fallback_path


class ProjectExternalUserManager(models.Manager):

    def list_ext_users_by_project_uuid(self, project_uuid):
        return super().filter(project_uuid=project_uuid)
    
    def get_contact_email_by_user(self, username):
        return super().filter(username=username).first()


class ProjectExternalUser(models.Model):
    email = models.CharField(max_length=255, db_index=True)
    username = models.CharField(max_length=255, db_index=True)
    project_uuid = models.CharField(max_length=36, db_index=True)
    activated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    objects = ProjectExternalUserManager()

    class Meta:
        unique_together = (('email', 'project_uuid'),)
        db_table = 'project_external_users'


class PortalDomainAliasManager(models.Manager):

    def _prefix_cache_key(self, prefix):
        return 'portal_domain_alias:prefix:%s' % prefix

    def _project_cache_key(self, project_uuid):
        return 'portal_domain_alias:project:%s' % project_uuid

    def get_by_prefix(self, prefix):
        try:
            normalized_prefix = normalize_portal_subdomain_prefix(prefix)
        except ValueError:
            return None
        prefix_cache_key = self._prefix_cache_key(normalized_prefix)
        cached_value = cache.get(prefix_cache_key)
        if isinstance(cached_value, dict):
            return SimpleNamespace(**cached_value)
        if cached_value == PORTAL_DOMAIN_CACHE_MISS_VALUE:
            return None

        alias = super().filter(prefix=normalized_prefix).values(*PORTAL_DOMAIN_ALIAS_CACHE_FIELDS).first()
        if not alias:
            cache.set(prefix_cache_key, PORTAL_DOMAIN_CACHE_MISS_VALUE, PORTAL_DOMAIN_CACHE_MISS_TIMEOUT)
            return None
        cache.set(prefix_cache_key, alias, PORTAL_DOMAIN_CACHE_TIMEOUT)
        return SimpleNamespace(**alias)

    def get_by_project_uuid(self, project_uuid):
        project_uuid = str(project_uuid)
        project_cache_key = self._project_cache_key(project_uuid)
        cached_value = cache.get(project_cache_key)
        if isinstance(cached_value, dict):
            return SimpleNamespace(**cached_value)
        if cached_value == PORTAL_DOMAIN_CACHE_MISS_VALUE:
            return None

        alias = super().filter(project_uuid=project_uuid).values(*PORTAL_DOMAIN_ALIAS_CACHE_FIELDS).first()
        if not alias:
            cache.set(project_cache_key, PORTAL_DOMAIN_CACHE_MISS_VALUE, PORTAL_DOMAIN_CACHE_MISS_TIMEOUT)
            return None
        cache.set(project_cache_key, alias, PORTAL_DOMAIN_CACHE_TIMEOUT)
        return SimpleNamespace(**alias)

    def get_by_host(self, host):
        try:
            prefix = get_portal_subdomain_prefix(host)
        except ValueError:
            return None
        if not prefix:
            return None
        return self.get_by_prefix(prefix)

    def generate_unique_prefix(self, length=6):
        reserved_prefixes = get_portal_reserved_subdomain_prefixes()
        while True:
            prefix = generate_random_string_lower_digits(length)
            if prefix in reserved_prefixes:
                continue
            if not super().filter(prefix=prefix).exists():
                return prefix

    def ensure_alias(self, project_uuid):
        for _index in range(10):
            alias = super().filter(project_uuid=str(project_uuid)).first()
            if alias:
                return alias

            alias = self.model(
                project_uuid=project_uuid,
                prefix=self.generate_unique_prefix(),
            )
            try:
                alias.save()
                return alias
            except IntegrityError:
                existing_alias = super().filter(project_uuid=str(project_uuid)).first()
                if existing_alias:
                    return existing_alias

        raise IntegrityError('Failed to create portal domain alias.')

    def reset_alias_prefix(self, project_uuid):
        alias = self.ensure_alias(project_uuid)
        alias.prefix = self.generate_unique_prefix()
        alias.save()
        return alias


class PortalDomainAlias(models.Model):
    prefix = models.CharField(max_length=63, unique=True)
    project_uuid = models.CharField(max_length=36, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PortalDomainAliasManager()

    class Meta:
        db_table = 'portal_domain_aliases'

    def save(self, *args, **kwargs):
        old_prefix = None
        old_project_uuid = None
        if self.pk:
            old_config = PortalDomainAlias.objects.filter(pk=self.pk).values('prefix', 'project_uuid').first()
            if old_config:
                old_prefix = old_config.get('prefix')
                old_project_uuid = old_config.get('project_uuid')

        self.prefix = normalize_portal_subdomain_prefix(self.prefix)
        self.project_uuid = str(self.project_uuid)
        result = super().save(*args, **kwargs)
        cache.delete(PortalDomainAlias.objects._prefix_cache_key(self.prefix))
        cache.delete(PortalDomainAlias.objects._project_cache_key(self.project_uuid))
        if old_prefix and old_prefix != self.prefix:
            cache.delete(PortalDomainAlias.objects._prefix_cache_key(old_prefix))
        if old_project_uuid and old_project_uuid != self.project_uuid:
            cache.delete(PortalDomainAlias.objects._project_cache_key(old_project_uuid))
        return result

    def delete(self, *args, **kwargs):
        prefix = self.prefix
        project_uuid = self.project_uuid
        result = super().delete(*args, **kwargs)
        cache.delete(PortalDomainAlias.objects._prefix_cache_key(prefix))
        cache.delete(PortalDomainAlias.objects._project_cache_key(project_uuid))
        return result

class PortalCustomDomainManager(models.Manager):

    def _domain_cache_key(self, domain):
        return 'portal_custom_domain:domain:%s' % domain

    def _verified_project_cache_key(self, project_uuid):
        return 'portal_custom_domain:verified_project:%s' % project_uuid

    def get_by_domain(self, domain):
        try:
            normalized_domain = normalize_portal_custom_domain(domain)
        except ValueError:
            return None
        domain_cache_key = self._domain_cache_key(normalized_domain)
        cached_value = cache.get(domain_cache_key)
        if isinstance(cached_value, dict):
            return SimpleNamespace(**cached_value)
        if cached_value == PORTAL_DOMAIN_CACHE_MISS_VALUE:
            return None

        custom_domain = super().filter(domain=normalized_domain).values(*PORTAL_CUSTOM_DOMAIN_CACHE_FIELDS).first()
        if not custom_domain:
            cache.set(domain_cache_key, PORTAL_DOMAIN_CACHE_MISS_VALUE, PORTAL_DOMAIN_CACHE_MISS_TIMEOUT)
            return None
        cache.set(domain_cache_key, custom_domain, PORTAL_DOMAIN_CACHE_TIMEOUT)
        return SimpleNamespace(**custom_domain)

    def get_verified_by_project_uuid(self, project_uuid):
        project_uuid = str(project_uuid)
        project_cache_key = self._verified_project_cache_key(project_uuid)
        cached_value = cache.get(project_cache_key)
        if isinstance(cached_value, dict):
            return SimpleNamespace(**cached_value)
        if cached_value == PORTAL_DOMAIN_CACHE_MISS_VALUE:
            return None

        custom_domain = super().filter(
            project_uuid=project_uuid,
            verified=True,
        ).values(*PORTAL_CUSTOM_DOMAIN_CACHE_FIELDS).first()
        if not custom_domain:
            cache.set(project_cache_key, PORTAL_DOMAIN_CACHE_MISS_VALUE, PORTAL_DOMAIN_CACHE_MISS_TIMEOUT)
            return None
        cache.set(project_cache_key, custom_domain, PORTAL_DOMAIN_CACHE_TIMEOUT)
        return SimpleNamespace(**custom_domain)

    def delete_by_project_uuid(self, project_uuid):
        binding = super().filter(project_uuid=str(project_uuid)).first()
        if not binding:
            return

        cache.delete(self._domain_cache_key(binding.domain))
        cache.delete(self._verified_project_cache_key(binding.project_uuid))
        cache.delete(get_portal_tls_ask_cache_key(binding.domain))
        super().filter(project_uuid=str(project_uuid)).delete()


class PortalCustomDomain(models.Model):
    domain = models.CharField(max_length=255, unique=True)
    project_uuid = models.CharField(max_length=36, unique=True, db_index=True)
    verification_token = models.CharField(max_length=64)
    verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PortalCustomDomainManager()

    class Meta:
        db_table = 'portal_custom_domains'

    def save(self, *args, **kwargs):
        old_domain = None
        old_project_uuid = None
        if self.pk:
            old_config = PortalCustomDomain.objects.filter(pk=self.pk).values('domain', 'project_uuid').first()
            if old_config:
                old_domain = old_config.get('domain')
                old_project_uuid = old_config.get('project_uuid')

        self.domain = normalize_portal_custom_domain(self.domain)
        self.project_uuid = str(self.project_uuid)
        if not self.verification_token:
            self.verification_token = token_hex(16)
        result = super().save(*args, **kwargs)
        cache.delete(PortalCustomDomain.objects._domain_cache_key(self.domain))
        cache.delete(PortalCustomDomain.objects._verified_project_cache_key(self.project_uuid))
        cache.delete(get_portal_tls_ask_cache_key(self.domain))
        if old_domain and old_domain != self.domain:
            cache.delete(PortalCustomDomain.objects._domain_cache_key(old_domain))
            cache.delete(get_portal_tls_ask_cache_key(old_domain))
        if old_project_uuid and old_project_uuid != self.project_uuid:
            cache.delete(PortalCustomDomain.objects._verified_project_cache_key(old_project_uuid))
        return result

    def delete(self, *args, **kwargs):
        domain = self.domain
        project_uuid = self.project_uuid
        result = super().delete(*args, **kwargs)
        cache.delete(PortalCustomDomain.objects._domain_cache_key(domain))
        cache.delete(PortalCustomDomain.objects._verified_project_cache_key(project_uuid))
        cache.delete(get_portal_tls_ask_cache_key(domain))
        return result

    @property
    def txt_record_name(self):
        return '%s.%s' % (CUSTOM_DOMAIN_TXT_RECORD_PREFIX, self.domain)

    @property
    def txt_record_value(self):
        return '%s%s' % (CUSTOM_DOMAIN_VERIFICATION_VALUE_PREFIX, self.verification_token)

    def reset_verification(self):
        self.verification_token = token_hex(16)
        self.verified = False
        self.verified_at = None

    def mark_verified(self):
        self.verified = True
        self.verified_at = timezone.now()


class PortalChatSessionsManager(models.Manager):

    def create_session(self, project_uuid, session_name, username):
        session_uuid = str(uuid4())
        session = self.model(
            project_uuid=project_uuid,
            session_uuid=session_uuid,
            username=username,
            session_name=session_name,
        )
        session.save()
        return session

    def get_sessions_by_project(self, project_uuid, username):
        return self.filter(project_uuid=project_uuid, username=username).order_by('-updated_at')

    def get_session_by_uuid(self, session_uuid):
        try:
            return self.get(session_uuid=session_uuid)
        except self.model.DoesNotExist:
            return None


class PortalChatSessions(models.Model):
    id = models.BigAutoField(primary_key=True)
    project_uuid = models.CharField(max_length=36, db_index=True)
    session_uuid = models.CharField(max_length=36, unique=True, db_index=True)
    username = models.CharField(max_length=255, db_index=True)
    session_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PortalChatSessionsManager()

    class Meta:
        db_table = 'portal_chat_sessions'

    def to_dict(self):
        return {
            'id': self.id,
            'project_uuid': self.project_uuid,
            'session_uuid': self.session_uuid,
            'username': self.username,
            'session_name': self.session_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class PortalChatMessagesManager(models.Manager):

    def create_message(self, session_uuid, message_id, role, content, as_context=True, attachments=[]):
        message = self.model(
            session_uuid=session_uuid,
            message_id=message_id,
            role=role,
            content=content,
            as_context=as_context,
            attachments=json.dumps(attachments),
        )
        message.save()
        return message

    def get_messages_by_session(self, session_uuid):
        return self.filter(session_uuid=session_uuid).order_by('created_at')

    def get_last_message_by_session(self, session_uuid):
        """Retrieve the last message of the session"""
        return self.filter(session_uuid=session_uuid).order_by('-created_at').first()

    def clear_context(self, session_uuid):
        self.create_message(session_uuid, None, 'chat_manager', '<break_context>', False)
        records = self.filter(session_uuid=session_uuid)
        records.update(as_context=False)


class PortalChatMessages(models.Model):
    id = models.BigAutoField(primary_key=True)
    session_uuid = models.CharField(max_length=36, null=False)
    message_id = models.CharField(max_length=4, null=True)
    role = models.CharField(max_length=20)
    content = models.TextField(null=True)
    attachments = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    as_context = models.BooleanField(default=True)

    objects = PortalChatMessagesManager()

    class Meta:
        db_table = 'portal_chat_messages'
        indexes = [
            models.Index(fields=['session_uuid', 'created_at']),
        ]

    def to_dict(self):
        try:
            attachments = json.loads(self.attachments) if self.attachments else []
        except (TypeError, ValueError):
            attachments = []
        if not isinstance(attachments, list):
            attachments = []
        return {
            'id': self.id,
            'session_uuid': self.session_uuid,
            'message_id': self.message_id,
            'role': self.role,
            'content': self.content,
            'attachments': attachments,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'as_context': self.as_context,
        }


class PortalIssueView(object):

    def __init__(self, name, view_type='table', config={}, folders_views_ids=None):
        self.name = name
        self.type = view_type
        self.config = config
        self.details = {}

        self.init_view(folders_views_ids)

    def init_view(self, folders_views_ids=None):
        self.details = {
            "_id": generate_views_unique_id(4, folders_views_ids),
            "table_id": '0000',  # by default
            "name": self.name,
            'basic_filters': [
                {'column_key': 'state', 'filter_predicate': 'is_any_of', 'filter_term': ['open']},
                {'column_key': 'type', 'filter_predicate': 'is_any_of', 'filter_term': []},
                {'column_key': 'tags', 'filter_predicate': 'has_any_of', 'filter_term': []}
            ],
            "filters": [],
            'sorts': [{ 'column_key': 'created_at', 'sort_type': 'down' }],
            "groupbys": [],
            "filter_conjunction": "Or",
            "hidden_columns": [],
            "type": self.type,
        }
        self.details.update(self.config)


class PortalIssueViewsManager(models.Manager):

    def update_init_view_details(self, project_uuid, details):
        from seahub.project.seadb_api import SeaDBAPI
        from seahub.seadb_models.utils import get_seadb_table_columns
        seadb_api = SeaDBAPI()
        columns = get_seadb_table_columns(seadb_api, project_uuid, SchemaTables.PORTAL_ISSUES.table_name())
        views = details.get('views', [])
        for v in views:
            basic_filters = v.get('basic_filters', [])
            for basic_filter in basic_filters:
                column_key = basic_filter['column_key']

                column = next((column for column in columns if column['name'] == column_key), None)
                if column:
                    column_name = column['name']
                    basic_filter['column_key'] = column['key']
                    if column_name in ['state', 'type', 'tags']:
                        data = column.get('data', {})
                        if data:
                            options = data.get('options', [])
                            filter_term = basic_filter.get('filter_term', [])
                            new_filter_term = []
                            for option_name in filter_term:
                                option = next((option for option in options if option['name'] == option_name), None)
                                if option:
                                    new_filter_term.append(option['id'])
                            basic_filter['filter_term'] = new_filter_term
            v['basic_filters'] = basic_filters

            sorts = v.get('sorts', [])
            for item in sorts:
                column_key = item['column_key']
                column = next((column for column in columns if column['name'] == column_key), None)
                if column:
                    item['column_key'] = column['key']
            v['sorts'] = sorts
            details['views'] = views
        return details

    def get_record(self, project_uuid):
        project_uuid = uuid_str_to_32_chars(project_uuid)
        record = self.filter(project_uuid=project_uuid).first()
        if not record:
            details = self.update_init_view_details(project_uuid, deepcopy(PORTAL_ISSUES_DEFAULT_DETAILS))
            record = self.create(
                project_uuid=project_uuid,
                details=json.dumps(details)
            )
        return record

    def list_views(self, project_uuid):
        record = self.get_record(project_uuid)
        return json.loads(record.details)

    def get_view(self, project_uuid, view_id):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        for v in view_details['views']:
            if v.get('_id') == view_id:
                return v
        return None

    def add_view(self, project_uuid, view_name, view_type='table', view_data={}):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        view_name = get_no_duplicate_obj_name(view_name, record.views_names)
        exist_folders_views_ids = record.folders_views_ids
        new_view = PortalIssueView(view_name, view_type, view_data, exist_folders_views_ids)
        details = new_view.details
        view_id = details.get('_id')
        view_details['views'].append(details)
        view_details = self.update_init_view_details(project_uuid, view_details)
        new_view_nav = { '_id': view_id, 'type': 'view' }
        navigation.append(new_view_nav)
        record.details = json.dumps(view_details)
        record.save()
        return new_view.details

    def update_view(self, project_uuid, view_id, view_dict):
        record = self.get_record(project_uuid)
        view_dict.pop('_id', '')
        if 'name' in view_dict:
            exist_obj_names = record.views_names
            view_dict['name'] = get_no_duplicate_obj_name(view_dict['name'], exist_obj_names)
        view_details = json.loads(record.details)
        for v in view_details['views']:
            if v.get('_id') == view_id:
                v.update(view_dict)
                break
        record.details = json.dumps(view_details)
        record.save()
        return view_details

    def delete_view(self, project_uuid, view_id):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        views = view_details.get('views', [])

        for view in views:
            if view.get('_id') == view_id:
                views.remove(view)
                break
        for nav_item in navigation:
            if nav_item.get('_id') == view_id:
                navigation.remove(nav_item)
                break

        record.details = json.dumps(view_details)
        record.save()
        return view_details

    def move_view(self, project_uuid, source_view_id, target_view_id):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])

        # Find and remove source
        source_nav = None
        for nav in navigation:
            if nav.get('_id') == source_view_id:
                source_nav = nav
                navigation.remove(nav)
                break

        if not source_nav:
            return view_details

        # Insert at target position
        target_index = -1
        for i, nav in enumerate(navigation):
            if nav.get('_id') == target_view_id:
                target_index = i
                break

        if target_index >= 0:
            navigation.insert(target_index, source_nav)
        else:
            navigation.append(source_nav)

        record.details = json.dumps(view_details)
        record.save()
        return view_details

    def duplicate_view(self, view_id, record):
        view_details = json.loads(record.details)
        exist_folders_views_ids = record.folders_views_ids
        new_view_id = generate_views_unique_id(4, exist_folders_views_ids)
        duplicate_view = next((copy.deepcopy(view) for view in view_details['views'] if view.get('_id') == view_id), None)
        duplicate_view['_id'] = new_view_id
        view_name = get_no_duplicate_obj_name(duplicate_view['name'], record.views_names)
        duplicate_view['name'] = view_name
        view_details['views'].append(duplicate_view)
        navigation = view_details.get('navigation', [])
        new_view_nav = {'_id': new_view_id, 'type': 'view'}
        navigation.append(new_view_nav)

        record.details = json.dumps(view_details)
        record.save()

        return duplicate_view


class PortalIssueViews(models.Model):
    project_uuid = models.UUIDField(db_index=True)
    details = models.TextField()

    objects = PortalIssueViewsManager()

    class Meta:
        db_table = 'portal_issue_views'

    
    @property
    def folders_ids(self):
        details = json.loads(self.details)
        navigation = details.get('navigation', [])
        return [folder.get('_id') for folder in navigation if folder.get('type', None) == 'folder']

    @property
    def folders_names(self):
        details = json.loads(self.details)
        navigation = details.get('navigation', [])
        return [folder.get('name') for folder in navigation if folder.get('type', None) == 'folder']

    @property
    def views_ids(self):
        views = json.loads(self.details)['views']
        return [v.get('_id') for v in views]

    @property
    def views_names(self):
        views = json.loads(self.details)['views']
        return [v.get('name') for v in views]

    @property
    def folders_views_ids(self):
        return self.folders_ids + self.views_ids
