# -*- coding: utf-8 -*-
import json
import re

import yaml

from seahub.project.models import Projects
from seahub.project.constants import merge_project_settings_defaults
from seahub.seadb_models.models import SchemaTables
from seahub.utils.ai_client import list_builtin_skills


MAX_SKILL_MARKDOWN_SIZE = 128 * 1024
MAX_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024
SKILL_NAME_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
SKILL_HEADER_SEPARATOR = '===================='


def _parse_bool(value, default=False, key_name='support_agent'):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ('1', 'true', 'yes', 'on'):
            return True
        if normalized in ('0', 'false', 'no', 'off'):
            return False
    field_label = key_name.replace('_', ' ').capitalize()
    raise ValueError(f'{field_label} must be a boolean value.')


def split_skill_document(content):
    if not isinstance(content, str):
        raise ValueError('Content must be a string.')
    normalized = content.replace('\r\n', '\n').replace('\r', '\n').replace('\ufeff', '', 1)
    header, separator, body = normalized.partition(SKILL_HEADER_SEPARATOR)
    if not separator:
        raise ValueError('SKILL.md frontmatter is required.')
    return header.strip(), body.strip()


def parse_skill_markdown(content, expected_name=None):
    if not isinstance(content, str):
        raise ValueError('Content must be a string.')
    if not content.strip():
        raise ValueError('Content cannot be empty.')
    if len(content.encode('utf-8')) > MAX_SKILL_MARKDOWN_SIZE:
        raise ValueError(f'Content cannot exceed {MAX_SKILL_MARKDOWN_SIZE} bytes.')

    header_text, body = split_skill_document(content)

    try:
        frontmatter = yaml.safe_load(header_text) or {}
    except Exception:
        raise ValueError('SKILL.md frontmatter must be valid YAML.')

    if not isinstance(frontmatter, dict):
        raise ValueError('SKILL.md frontmatter must be a mapping.')

    name = frontmatter.get('name')
    if not isinstance(name, str):
        raise ValueError('Skill name must be a string.')
    name = name.strip()
    if not name:
        raise ValueError('Skill name cannot be empty.')
    if len(name) > MAX_NAME_LENGTH:
        raise ValueError(f'Skill name cannot exceed {MAX_NAME_LENGTH} characters.')
    if not SKILL_NAME_RE.match(name):
        raise ValueError('Skill name must use lowercase letters, digits and hyphens.')
    if expected_name and name != expected_name:
        raise ValueError('Skill name does not match the target skill.')

    description = frontmatter.get('description')
    if not isinstance(description, str):
        raise ValueError('Skill description must be a string.')
    description = description.strip()
    if not description:
        raise ValueError('Skill description cannot be empty.')
    if len(description) > MAX_DESCRIPTION_LENGTH:
        raise ValueError(f'Skill description cannot exceed {MAX_DESCRIPTION_LENGTH} characters.')

    support_agent = _parse_bool(frontmatter.get('support_agent'), default=False, key_name='support_agent')

    return {
        'content': content.strip(),
        'frontmatter': frontmatter,
        'body': body,
        'name': name,
        'description': description,
        'support_agent': support_agent,
    }


def _coerce_bool(value, field_name='value'):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ('1', 'true', 'yes', 'on'):
            return True
        if normalized in ('0', 'false', 'no', 'off'):
            return False
    field_label = field_name.replace('_', ' ').capitalize()
    raise ValueError(f'{field_label} must be a boolean value.')


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
