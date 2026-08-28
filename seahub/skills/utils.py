# -*- coding: utf-8 -*-
import json
import re

from seahub.project.models import Projects
from seahub.project.constants import merge_project_settings_defaults
from seahub.seadb_models.models import SchemaTables
from seahub.utils.ai_client import list_builtin_skills


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
        'support_agent': bool(skill.get('support_agent', False)),
        'source': 'builtin',
        'readonly': True,
        'enabled': skill.get('name') not in disabled_builtin_set,
        'revision': 'builtin',
    }
    if include_details:
        item.update({
            'content': skill.get('content', ''),
        })
    return item


def _serialize_custom_skill(row, include_details=False):
    item = {
        'name': row.get('name', ''),
        'description': row.get('description', ''),
        'support_agent': bool(row.get('support_agent', False)),
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
        })
    return item


def _list_custom_skill_rows(seadb_api, project_uuid):
    table_name = SchemaTables.SKILLS.table_name()
    sql = (
        f"SELECT `_pk`, `name`, `description`, `support_agent`, `enabled`, `creator`, `last_modifier`, "
        f"`created_time`, `modified_time`, `deleted` FROM `{table_name}` "
        "WHERE (`deleted` = False OR `deleted` IS NULL) ORDER BY `modified_time` DESC"
    )
    return seadb_api.query_rows(project_uuid, sql, convert_keys=True).get('results', [])


def _get_custom_skill_row_by_name(seadb_api, project_uuid, skill_name):
    table_name = SchemaTables.SKILLS.table_name()
    sql = (
        f"SELECT `_pk`, `name`, `description`, `content`, `support_agent`, "
        f"`enabled`, `creator`, `last_modifier`, "
        f"`created_time`, `modified_time`, `deleted` FROM `{table_name}` "
        f"WHERE `name` = '{skill_name}' AND (`deleted` = False OR `deleted` IS NULL) LIMIT 1"
    )
    rows = seadb_api.query_rows(project_uuid, sql, convert_keys=True).get('results', [])
    return rows[0] if rows else None
