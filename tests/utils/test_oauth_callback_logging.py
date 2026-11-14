"""Exercise callback failure logs without initializing deployment-specific Django settings.

Only the callback function is compiled from the production source; dependencies
and the login decorator are excluded. These tests do not cover authentication.
"""

import ast
import base64
import logging
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest


PROVIDERS = ['linear', 'confluence', 'discord', 'jira', 'notion']
VIEWS_PATH = Path(__file__).resolve().parents[2] / 'seahub/project/views.py'


@pytest.mark.parametrize('filename,function_name,message', [
    ('utils.py', 'fetch_oauth_email_sender_info', 'Failed to fetch sender profile.'),
    ('views.py', 'email_oauth_callback', 'Email OAuth provider rejected authorization.'),
    ('views.py', 'email_oauth_callback', 'Email OAuth token exchange failed.'),
])
def test_email_oauth_reported_logs_use_only_fixed_messages(filename, function_name, message, caplog):
    source_path = VIEWS_PATH.with_name(filename)
    source = ast.parse(source_path.read_text())
    function = next(node for node in source.body
                    if isinstance(node, ast.FunctionDef) and node.name == function_name)
    logs = [node for node in ast.walk(function)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name) and node.func.value.id == 'logger'
            and node.args and isinstance(node.args[0], ast.Constant)
            and node.args[0].value == message]
    assert len(logs) == 1
    log = logs[0]
    assert len(log.args) == 1
    assert not log.keywords
    module = ast.fix_missing_locations(ast.Module(body=[ast.Expr(value=log)], type_ignores=[]))
    # No configuration, provider or exception objects are available to the log.
    exec(compile(module, str(source_path), 'exec'), {
        'logger': logging.getLogger('oauth_callback_logging_test'),
    })
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.getMessage() == message
    assert not record.args
    assert record.exc_info is None
    assert record.stack_info is None


def test_email_sender_profile_fallback_log_excludes_exception_details(caplog):
    source = ast.parse(VIEWS_PATH.read_text())
    callback = next(node for node in source.body
                    if isinstance(node, ast.FunctionDef) and node.name == 'email_oauth_callback')
    profile_request = next(node for node in ast.walk(callback)
                           if isinstance(node, ast.Try) and any(
                               isinstance(handler.type, ast.Name) and handler.type.id == 'EmailOAuthProfileError'
                               for handler in node.handlers))
    fallback = next(handler for handler in profile_request.handlers
                    if isinstance(handler.type, ast.Name) and handler.type.id == 'Exception')
    # Execute the production logging statement with a sensitive exception.
    statement = fallback.body[0]
    module = ast.Module(body=[statement], type_ignores=[])
    exec(compile(module, str(VIEWS_PATH), 'exec'), {
        'logger': logging.getLogger('oauth_callback_logging_test'),
        'e': RuntimeError('private-token-and-credential-details'),
    })
    assert len(caplog.records) == 1
    assert 'RuntimeError' in caplog.text
    assert 'private-token-and-credential-details' not in caplog.text
    assert caplog.records[0].exc_info is None


def load_callback(provider, namespace):
    source = ast.parse(VIEWS_PATH.read_text())
    name = provider + '_oauth_callback'
    function = next(node for node in source.body if isinstance(node, ast.FunctionDef) and node.name == name)
    function.decorator_list = []
    module = ast.Module(body=[function], type_ignores=[])
    exec(compile(module, str(VIEWS_PATH), 'exec'), namespace)
    return namespace[name]


@pytest.mark.parametrize('provider,failure', [
    (provider, failure)
    for provider in PROVIDERS
    for failure in ('request', 'response', 'missing_token')
    if (provider, failure) != ('discord', 'missing_token')
])
def test_oauth_callback_failure_logs_exclude_sensitive_values(provider, failure, caplog):
    sensitive_values = {
        'client_id': 'private-client-id',
        'client_secret': 'private-client-secret',
        'code': 'private-authorization-code',
        'token_url': 'https://private.example/token',
        'refresh_token': 'private-refresh-token',
    }
    sensitive_details = str(sensitive_values)
    response = Mock(status_code=400 if failure == 'response' else 200, text=sensitive_details)
    # Missing access_token must not cause the remaining refresh token to be logged.
    response.json.return_value = sensitive_values.copy()
    post = Mock(return_value=response)
    if failure == 'request':
        post.side_effect = RuntimeError(sensitive_details)

    render_error = Mock(return_value=object())
    oauth_utils = Mock()
    oauth_utils.get_oauth_session.return_value = {
        'state': 'state-1', 'project_uuid': 'project-1', 'status': 'in-progress',
    }
    namespace = {
        'logger': logging.getLogger('oauth_callback_logging_test'),
        'requests': SimpleNamespace(post=post),
        'Projects': Mock(),
        'ProjectConnectionOauth': Mock(),
        'check_project_admin_permission': Mock(return_value=True),
        'render_error': render_error,
        '_': lambda value: value,
        'settings': SimpleNamespace(
            CONFLUENCE_CLIENT_ID=sensitive_values['client_id'],
            CONFLUENCE_CLIENT_SECRET=sensitive_values['client_secret'],
            CONFLUENCE_REDIRECT_URL='https://example.com/callback',
            NOTION_CLIENT_ID=sensitive_values['client_id'],
            NOTION_CLIENT_SECRET=sensitive_values['client_secret'],
            NOTION_REDIRECT_URL='https://example.com/callback',
        ),
        'NotionOAuthUtils': oauth_utils,
        'NOTION_VERSION': '2026-03-11',
        'base64': base64,
    }
    for prefix in ('LINEAR', 'DISCORD', 'JIRA'):
        namespace[prefix + '_CLIENT_ID'] = sensitive_values['client_id']
        namespace[prefix + '_CLIENT_SECRET'] = sensitive_values['client_secret']
        namespace[prefix + '_REDIRECT_URL'] = 'https://example.com/callback'

    request = Mock()
    request.GET = {'code': sensitive_values['code'], 'state': 'state-1', 'guild_id': 'guild-1'}
    request.session = {
        provider + '_oauth_state': 'state-1',
        provider + '_oauth_project_uuid': 'project-1',
    }
    result = load_callback(provider, namespace)(request)

    assert result is render_error.return_value
    post.assert_called_once()
    namespace['ProjectConnectionOauth'].objects.upsert_token.assert_not_called()
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert provider.capitalize() + ' OAuth token' in record.getMessage()
    if failure == 'request':
        assert 'RuntimeError' in record.getMessage()
    elif failure == 'response':
        assert '400' in record.getMessage()
    else:
        assert 'missing access' in record.getMessage()
    for value in sensitive_values.values():
        assert value not in caplog.text
    assert record.exc_info is None
    assert record.stack_info is None
