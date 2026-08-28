# -*- coding: utf-8 -*-
import datetime
import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.utils import check_project_permission, check_project_admin_permission
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import SchemaTables
from seahub.seadb_models.utils import ensure_skills_seadb_table
from seahub.utils.ai_client import get_builtin_skill
from seahub.utils.decorators import require_org_context
from seahub.skills.utils import (
    SKILL_NAME_RE,
    _coerce_bool,
    parse_skill_markdown,
    _get_custom_skill_row_by_name,
    _get_disabled_builtin_skills,
    _list_custom_skill_rows,
    _load_builtin_map,
    _load_builtin_skills,
    _load_project,
    _serialize_builtin_skill,
    _serialize_custom_skill,
    _set_builtin_skill_enabled,
)


logger = logging.getLogger(__name__)


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
            parsed = parse_skill_markdown(content)
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
                SchemaTables.SKILLS.column.support_agent.name: bool(parsed.get('support_agent', False)),
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

    Deliberately exposes names only: skill content and advanced configuration remain
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
                parsed = parse_skill_markdown(content, expected_name=skill_name)
                update_row[SchemaTables.SKILLS.column.name.name] = parsed['name']
                update_row[SchemaTables.SKILLS.column.description.name] = parsed['description']
                update_row[SchemaTables.SKILLS.column.content.name] = str(content).strip()
                update_row[SchemaTables.SKILLS.column.support_agent.name] = bool(parsed.get('support_agent', False))

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
