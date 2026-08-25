# -*- coding: utf-8 -*-
import datetime
import json
import logging
import re

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects
from seahub.project.constants import merge_project_settings_defaults
from seahub.project.utils import check_project_permission, check_project_admin_permission
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import SchemaTables
from seahub.seadb_models.utils import ensure_skills_seadb_table
from seahub.utils.ai_client import list_builtin_skills, get_builtin_skill, parse_skill
from seahub.utils.decorators import require_org_context


logger = logging.getLogger(__name__)
SKILL_NAME_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')


def _coerce_bool(value, field_name='value'):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ('1', 'true', 'yes', 'on'):
            return True
        if normalized in ('0', 'false', 'no', 'off'):
            return False
    raise ValueError(f'{field_name} invalid.')


def _encode_metadata(metadata):
    metadata = metadata or {}
    if not isinstance(metadata, dict):
        raise ValueError('metadata invalid.')
    return json.dumps(metadata, separators=(',', ':'), ensure_ascii=False)


def _decode_metadata(value):
    if isinstance(value, dict):
        return value
    if value in (None, ''):
        return {}
    metadata = json.loads(value)
    if not isinstance(metadata, dict):
        raise ValueError('Stored metadata invalid.')
    return metadata


def _load_project(project_uuid):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return None, None
    return project, project.workspace


def _load_builtin_skills():
    builtin_skills = list_builtin_skills()
    if not isinstance(builtin_skills, list):
        return []
    result = []
    for item in builtin_skills:
        if not isinstance(item, dict):
            continue
        name = item.get('name')
        description = item.get('description')
        if not isinstance(name, str) or not isinstance(description, str):
            continue
        result.append(item)
    return result


def _load_builtin_map():
    return {
        skill['name']: skill
        for skill in _load_builtin_skills()
    }


def _get_project_settings(project):
    if not project.settings:
        return {}
    try:
        return json.loads(project.settings)
    except Exception:
        return {}


def _get_disabled_builtin_skills(project):
    project_settings = _get_project_settings(project)
    skills_settings = project_settings.get('skills') or {}
    disabled = skills_settings.get('disabled_builtins') or []
    if not isinstance(disabled, list):
        return []
    return [name for name in disabled if isinstance(name, str) and name]


def _set_builtin_skill_enabled(project, skill_name, enabled):
    project_settings = _get_project_settings(project)
    skills_settings = project_settings.get('skills') or {}
    disabled_set = set(_get_disabled_builtin_skills(project))
    if enabled:
        disabled_set.discard(skill_name)
    else:
        disabled_set.add(skill_name)
    skills_settings['disabled_builtins'] = sorted(disabled_set)
    project_settings['skills'] = skills_settings
    project.settings = json.dumps(merge_project_settings_defaults(project_settings))
    project.save(update_fields=['settings'])


def _serialize_builtin_skill(skill, disabled_builtin_set, include_details=False):
    item = {
        'name': skill.get('name', ''),
        'description': skill.get('description', ''),
        'source': 'builtin',
        'readonly': True,
        'enabled': skill.get('name') not in disabled_builtin_set,
        'revision': 'builtin',
    }
    if include_details:
        item.update({
            'content': skill.get('content', ''),
            'metadata': skill.get('metadata') or {},
        })
    return item


def _serialize_custom_skill(row, include_details=False):
    item = {
        'name': row.get('name', ''),
        'description': row.get('description', ''),
        'source': 'custom',
        'readonly': False,
        'enabled': bool(row.get('enabled', True)),
        'revision': row.get('modified_time'),
        'creator': row.get('creator'),
        'last_modifier': row.get('last_modifier'),
        'created_time': row.get('created_time'),
        'modified_time': row.get('modified_time'),
    }
    if include_details:
        item.update({
            'content': row['content'],
            'metadata': _decode_metadata(row.get('metadata')),
        })
    return item


def _list_custom_skill_rows(seadb_api, project_uuid):
    table_name = SchemaTables.SKILLS.table_name()
    sql = (
        f"SELECT `_pk`, `name`, `description`, `enabled`, `creator`, `last_modifier`, "
        f"`created_time`, `modified_time`, `deleted` FROM `{table_name}` "
        "WHERE (`deleted` = False OR `deleted` IS NULL) ORDER BY `modified_time` DESC"
    )
    return seadb_api.query_rows(project_uuid, sql, convert_keys=True).get('results', [])


def _get_custom_skill_row_by_name(seadb_api, project_uuid, skill_name):
    table_name = SchemaTables.SKILLS.table_name()
    sql = (
        f"SELECT `_pk`, `name`, `description`, `content`, `metadata`, "
        f"`enabled`, `creator`, `last_modifier`, "
        f"`created_time`, `modified_time`, `deleted` FROM `{table_name}` "
        f"WHERE `name` = '{skill_name}' AND (`deleted` = False OR `deleted` IS NULL) LIMIT 1"
    )
    rows = seadb_api.query_rows(project_uuid, sql, convert_keys=True).get('results', [])
    return rows[0] if rows else None


class SkillsAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        project, workspace = _load_project(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            seadb_api = SeaDBAPI()
            ensure_skills_seadb_table(seadb_api, project_uuid)
            custom_rows = _list_custom_skill_rows(seadb_api, project_uuid)
            builtin_skills = _load_builtin_skills()
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        disabled_builtin_set = set(_get_disabled_builtin_skills(project))
        skills = [
            _serialize_builtin_skill(skill, disabled_builtin_set)
            for skill in builtin_skills
        ]
        skills.extend([
            _serialize_custom_skill(row)
            for row in custom_rows
        ])
        return Response({'skills': skills})

    @require_org_context
    def post(self, request, project_uuid):
        project, workspace = _load_project(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        content = request.data.get('content')
        enabled_raw = request.data.get('enabled', True)
        try:
            enabled = _coerce_bool(enabled_raw, 'enabled')
            parsed = parse_skill(content)
        except ValueError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, str(e))

        try:
            builtin_map = _load_builtin_map()
            if parsed['name'] in builtin_map:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Custom skill name conflicts with a builtin skill.')

            seadb_api = SeaDBAPI()
            ensure_skills_seadb_table(seadb_api, project_uuid)
            if _get_custom_skill_row_by_name(seadb_api, project_uuid, parsed['name']):
                return api_error(status.HTTP_409_CONFLICT, 'Skill already exists.')

            now = datetime.datetime.now(datetime.UTC).isoformat()
            row = {
                SchemaTables.SKILLS.column.name.name: parsed['name'],
                SchemaTables.SKILLS.column.description.name: parsed['description'],
                SchemaTables.SKILLS.column.content.name: str(content).strip(),
                SchemaTables.SKILLS.column.metadata.name: _encode_metadata(parsed.get('metadata')),
                SchemaTables.SKILLS.column.enabled.name: enabled,
                SchemaTables.SKILLS.column.creator.name: username,
                SchemaTables.SKILLS.column.last_modifier.name: username,
                SchemaTables.SKILLS.column.created_time.name: now,
                SchemaTables.SKILLS.column.modified_time.name: now,
                SchemaTables.SKILLS.column.deleted.name: False,
            }
            res = seadb_api.insert_rows(project_uuid, SchemaTables.SKILLS.table_name(), [row])
            pks = res.get('pks') or []
            if len(pks) != 1:
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            row['_pk'] = pks[0]
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'skill': _serialize_custom_skill(row, include_details=True)}, status=status.HTTP_201_CREATED)


class SkillCommandsAPIView(APIView):
    """Member-readable list of enabled skill names for the chat command selector.

    Deliberately exposes names only: skill content and metadata remain
    restricted to project admins via the other endpoints.
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        project, workspace = _load_project(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            seadb_api = SeaDBAPI()
            ensure_skills_seadb_table(seadb_api, project_uuid)
            custom_rows = _list_custom_skill_rows(seadb_api, project_uuid)
            builtin_skills = _load_builtin_skills()
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        disabled_builtin_set = set(_get_disabled_builtin_skills(project))
        commands = [
            skill['name']
            for skill in builtin_skills
            if skill.get('name') and skill['name'] not in disabled_builtin_set
        ]
        commands.extend([
            row['name']
            for row in custom_rows
            if row.get('name') and row.get('enabled')
        ])
        return Response({'commands': commands})


class SkillAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid, skill_name):
        project, workspace = _load_project(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if not SKILL_NAME_RE.match(skill_name):
            return api_error(status.HTTP_400_BAD_REQUEST, 'skill_name invalid.')

        disabled_builtin_set = set(_get_disabled_builtin_skills(project))
        try:
            builtin_map = _load_builtin_map()
            if skill_name in builtin_map:
                skill = get_builtin_skill(skill_name) or builtin_map[skill_name]
                return Response({
                    'skill': _serialize_builtin_skill(skill, disabled_builtin_set, include_details=True),
                })

            seadb_api = SeaDBAPI()
            ensure_skills_seadb_table(seadb_api, project_uuid)
            row = _get_custom_skill_row_by_name(seadb_api, project_uuid, skill_name)
            if not row:
                return api_error(status.HTTP_404_NOT_FOUND, 'Skill not found.')
            return Response({'skill': _serialize_custom_skill(row, include_details=True)})
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @require_org_context
    def put(self, request, project_uuid, skill_name):
        project, workspace = _load_project(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if not SKILL_NAME_RE.match(skill_name):
            return api_error(status.HTTP_400_BAD_REQUEST, 'skill_name invalid.')

        content = request.data.get('content')
        enabled_raw = request.data.get('enabled', None)
        revision = request.data.get('revision')

        try:
            builtin_map = _load_builtin_map()
            if skill_name in builtin_map:
                if content is not None:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'Builtin skill content is read-only.')
                if enabled_raw is None:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'enabled invalid.')
                enabled = _coerce_bool(enabled_raw, 'enabled')
                _set_builtin_skill_enabled(project, skill_name, enabled)
                skill = get_builtin_skill(skill_name) or builtin_map[skill_name]
                return Response({
                    'skill': _serialize_builtin_skill(skill, set(_get_disabled_builtin_skills(project)), include_details=True),
                })

            seadb_api = SeaDBAPI()
            ensure_skills_seadb_table(seadb_api, project_uuid)
            row = _get_custom_skill_row_by_name(seadb_api, project_uuid, skill_name)
            if not row:
                return api_error(status.HTTP_404_NOT_FOUND, 'Skill not found.')

            if content is None and enabled_raw is None:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Nothing to update.')

            current_revision = row.get('modified_time')
            if revision is not None and str(revision) != str(current_revision):
                return api_error(status.HTTP_409_CONFLICT, 'Skill has been modified, please reload and retry.')

            update_row = {}
            if content is not None:
                parsed = parse_skill(content, expected_name=skill_name)
                update_row[SchemaTables.SKILLS.column.name.name] = parsed['name']
                update_row[SchemaTables.SKILLS.column.description.name] = parsed['description']
                update_row[SchemaTables.SKILLS.column.content.name] = str(content).strip()
                update_row[SchemaTables.SKILLS.column.metadata.name] = _encode_metadata(parsed.get('metadata'))

            if enabled_raw is not None:
                enabled = _coerce_bool(enabled_raw, 'enabled')
                update_row[SchemaTables.SKILLS.column.enabled.name] = enabled

            update_row[SchemaTables.SKILLS.column.last_modifier.name] = username
            update_row[SchemaTables.SKILLS.column.modified_time.name] = datetime.datetime.now(datetime.UTC).isoformat()

            seadb_api.update_rows(project_uuid, SchemaTables.SKILLS.table_name(), [{
                'pk': int(row['_pk']),
                'row': update_row,
            }])
            updated_row = _get_custom_skill_row_by_name(seadb_api, project_uuid, skill_name)
            if not updated_row:
                return api_error(status.HTTP_404_NOT_FOUND, 'Skill not found.')
            return Response({'skill': _serialize_custom_skill(updated_row, include_details=True)})
        except ValueError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, str(e))
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @require_org_context
    def delete(self, request, project_uuid, skill_name):
        project, workspace = _load_project(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if not SKILL_NAME_RE.match(skill_name):
            return api_error(status.HTTP_400_BAD_REQUEST, 'skill_name invalid.')

        try:
            builtin_map = _load_builtin_map()
            if skill_name in builtin_map:
                return api_error(status.HTTP_403_FORBIDDEN, 'Builtin skill cannot be deleted.')

            seadb_api = SeaDBAPI()
            ensure_skills_seadb_table(seadb_api, project_uuid)
            row = _get_custom_skill_row_by_name(seadb_api, project_uuid, skill_name)
            if not row:
                return api_error(status.HTTP_404_NOT_FOUND, 'Skill not found.')

            update_row = {
                SchemaTables.SKILLS.column.deleted.name: True,
                SchemaTables.SKILLS.column.enabled.name: False,
                SchemaTables.SKILLS.column.last_modifier.name: username,
                SchemaTables.SKILLS.column.modified_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
            }
            seadb_api.update_rows(project_uuid, SchemaTables.SKILLS.table_name(), [{
                'pk': int(row['_pk']),
                'row': update_row,
            }])
            return Response({'success': True})
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class SkillValidateAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def post(self, request, project_uuid):
        project, workspace = _load_project(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        content = request.data.get('content')
        expected_name = request.data.get('expected_name') or None
        try:
            parsed = parse_skill(content, expected_name=expected_name)
            builtin_map = _load_builtin_map()
            if parsed['name'] in builtin_map:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Custom skill name conflicts with a builtin skill.')

            seadb_api = SeaDBAPI()
            ensure_skills_seadb_table(seadb_api, project_uuid)
            exists = _get_custom_skill_row_by_name(seadb_api, project_uuid, parsed['name']) is not None
            return Response({
                'skill': {
                    'name': parsed['name'],
                    'description': parsed['description'],
                    'metadata': parsed.get('metadata') or {},
                },
                'exists': exists,
            })
        except ValueError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, str(e))
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
