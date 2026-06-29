import pytest
from django.urls import Resolver404, resolve

VALID_PROJECT_UUID = '12345678-1234-1234-1234-1234567890ab'
INVALID_PROJECT_UUID = '123456781234123412341234567890ab'


@pytest.mark.parametrize(
    ('path_template', 'url_name'),
    [
        ('/api/v1/project/{project_uuid}/related-users/', 'api-v1-project-related-users'),
        ('/api/v1/project/{project_uuid}/connections/1/views/', 'api-v1-connection-views'),
        ('/api/v1/project/{project_uuid}/tags/', 'api-v1-project-tags'),
        ('/api/v1/project/{project_uuid}/agent/runs/', 'api-v1-project-agent-runs'),
        ('/api/v1/project/{project_uuid}/upload-file/', 'api-v1-project-upload-file'),
        ('/upload-file/project/{project_uuid}/notes.txt', 'api-v1-get-project-upload-file'),
        ('/file/project/{project_uuid}/connections/1/path/notes.txt', 'api-v1-connection-file'),
        ('/file/project/{project_uuid}/notes.txt', 'api-v1-get-project-file'),
        ('/api/v1/project/{project_uuid}/tickets/', 'api-v1-project-tickets'),
        ('/api/v1/project/{project_uuid}/ticket/types/', 'api-v1-project-types'),
        ('/api/v1/project/{project_uuid}/ticket-folders/', 'api-v1-project-ticket-folders'),
        ('/api/v1/groups/1/trash-projects/{project_uuid}/', 'api-v1-group-trash-project'),
        ('/api/v1/trash-projects/{project_uuid}/', 'api-v1-trash-project'),
    ],
)
def test_project_uuid_routes_accept_36_char_uuid(path_template, url_name):
    path = path_template.format(project_uuid=VALID_PROJECT_UUID)

    match = resolve(path)

    assert match.url_name == url_name
    assert match.kwargs['project_uuid'] == VALID_PROJECT_UUID


@pytest.mark.parametrize(
    'path_template',
    [
        '/api/v1/project/{project_uuid}/related-users/',
        '/api/v1/project/{project_uuid}/connections/1/views/',
        '/api/v1/project/{project_uuid}/tags/',
        '/api/v1/project/{project_uuid}/agent/runs/',
        '/api/v1/project/{project_uuid}/upload-file/',
        '/upload-file/project/{project_uuid}/notes.txt',
        '/file/project/{project_uuid}/connections/1/path/notes.txt',
        '/file/project/{project_uuid}/notes.txt',
        '/api/v1/project/{project_uuid}/tickets/',
        '/api/v1/project/{project_uuid}/ticket/types/',
        '/api/v1/project/{project_uuid}/ticket-folders/',
        '/api/v1/groups/1/trash-projects/{project_uuid}/',
        '/api/v1/trash-projects/{project_uuid}/',
    ],
)
def test_project_uuid_routes_reject_short_uuid(path_template):
    path = path_template.format(project_uuid=INVALID_PROJECT_UUID)

    with pytest.raises(Resolver404):
        resolve(path)
