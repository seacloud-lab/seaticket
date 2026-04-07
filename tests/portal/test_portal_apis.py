import json
from unittest.mock import Mock, patch

import pytest

from seahub.portal.apis import (
    PortalKnowledgeBaseRecordsView,
    PortalKnowledgeBaseViewsView,
    PortalSettingsView,
    PortalTagsView,
    PortalIssuesView,
    PortalIssueMetadataView,
    PortalMyIssuesView,
    PortalIssueTrashAPIView,
    SQLGeneratorOptionInvalidError,
)


def _set_portal_settings(project, *, enable_portal=True, allow_anonymous=False,
                         enable_password_protection=False, show_knowledge_base=False, password=None):
    settings_dict = json.loads(project.settings) if project.settings else {}
    portal = settings_dict.get('portal', {})
    portal['enable_portal'] = bool(enable_portal)
    portal['allow_anonymous'] = bool(allow_anonymous)
    portal['enable_password_protection'] = bool(enable_password_protection)
    portal['show_knowledge_base'] = bool(show_knowledge_base)
    if password is not None:
        portal['password'] = password
    settings_dict['portal'] = portal
    project.settings = json.dumps(settings_dict)
    project.save(update_fields=['settings'])


class TestPortalIssuesView:

    def test_post_missing_title(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/portal/{project.uuid}/issues/", data={'content': json.dumps({'text': 'x'})}, format='multipart')
        request.user = project_creator

        resp = PortalIssuesView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_missing_content(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/portal/{project.uuid}/issues/", data={'title': 't'}, format='multipart')
        request.user = project_creator

        resp = PortalIssuesView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_invalid_content_json(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/portal/{project.uuid}/issues/", data={'title': 't', 'content': '{'}, format='multipart')
        request.user = project_creator

        resp = PortalIssuesView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_priority_invalid(self, factory, project_creator, real_project):
        project = real_project
        data = {'title': 't', 'content': json.dumps({'text': 'x'}), 'priority': 'x'}
        request = factory.post(f"/api/v1/portal/{project.uuid}/issues/", data=data, format='multipart')
        request.user = project_creator

        resp = PortalIssuesView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_creation_interval(self, factory, project_creator, real_project):
        project = real_project
        data = {'title': 't', 'content': json.dumps({'text': 'x'})}
        request = factory.post(f"/api/v1/portal/{project.uuid}/issues/", data=data, format='multipart')
        request.user = project_creator

        with patch('seahub.portal.apis.SeaDBAPI', return_value=Mock()), \
                patch('seahub.portal.apis.check_ticket_creation_interval', return_value=False):
            resp = PortalIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 429

    def test_post_upload_files_failed(self, factory, project_creator, real_project):
        project = real_project
        content = {'text': 'x', 'images': ['http://x/a.png']}
        data = {'title': 't', 'content': json.dumps(content)}
        request = factory.post(f"/api/v1/portal/{project.uuid}/issues/", data=data, format='multipart')
        request.user = project_creator

        with patch('seahub.portal.apis.SeaDBAPI', return_value=Mock()), \
                patch('seahub.portal.apis.check_ticket_creation_interval', return_value=True), \
                patch('seahub.portal.apis.upload_files_to_s3', side_effect=Exception('boom')):
            resp = PortalIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 500

    def test_post_insert_rows_returns_bad_pks(self, factory, project_creator, real_project):
        project = real_project
        data = {'title': 't', 'content': json.dumps({'text': 'x'})}
        request = factory.post(f"/api/v1/portal/{project.uuid}/issues/", data=data, format='multipart')
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.insert_rows.return_value = {'pks': []}

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.check_ticket_creation_interval', return_value=True):
            resp = PortalIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 500

    def test_post_internal_error(self, factory, project_creator, real_project):
        project = real_project
        data = {'title': 't', 'content': json.dumps({'text': 'x'})}
        request = factory.post(f"/api/v1/portal/{project.uuid}/issues/", data=data, format='multipart')
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.insert_rows.side_effect = Exception('boom')

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.check_ticket_creation_interval', return_value=True):
            resp = PortalIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 500

    def test_post_success(self, factory, project_creator, real_project):
        project = real_project
        content = {'text': 'x', 'images': ['http://x/a.png']}
        data = {'title': 't', 'content': json.dumps(content), 'priority': '3', 'tags': json.dumps(['a'])}
        request = factory.post(f"/api/v1/portal/{project.uuid}/issues/", data=data, format='multipart')
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.insert_rows.return_value = {'pks': [1]}

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.check_ticket_creation_interval', return_value=True), \
                patch('seahub.portal.apis.upload_files_to_s3', return_value={'http://x/a.png': 's3://a'}), \
                patch('seahub.portal.apis.replace_file_url_in_content', return_value='x'):
            resp = PortalIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 201
        assert resp.data['portal_issue']['_pk'] == 1


class TestPortalMyIssuesView:

    def test_post_start_invalid(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/portal/{project.uuid}/my-issues/", data={'start': '-1'}, format='multipart')
        request.user = project_creator

        resp = PortalMyIssuesView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_project_not_found(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        request = factory.post(f"/api/v1/portal/{project_uuid}/my-issues/", data={}, format='multipart')
        request.user = project_creator

        resp = PortalMyIssuesView.as_view()(request, project_uuid=project_uuid)

        assert resp.status_code == 403

    def test_post_sql_option_invalid(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/portal/{project.uuid}/my-issues/",
            data={'view_id': 'open', 'config': json.dumps({'basic_filters': []})},
            format='multipart'
        )
        request.user = project_creator

        with patch('seahub.portal.apis.SeaDBAPI', return_value=Mock()), \
                patch('seahub.portal.apis.list_my_portal_issues', side_effect=SQLGeneratorOptionInvalidError('bad')):
            resp = PortalMyIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert 'error_msg' in resp.data

    def test_post_internal_error(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/portal/{project.uuid}/my-issues/",
            data={'view_id': 'open', 'config': json.dumps({'basic_filters': []})},
            format='multipart'
        )
        request.user = project_creator

        with patch('seahub.portal.apis.SeaDBAPI', return_value=Mock()), \
                patch('seahub.portal.apis.list_my_portal_issues', side_effect=Exception('boom')):
            resp = PortalMyIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 500

    def test_post_success_appends_creator_filter(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/portal/{project.uuid}/my-issues/",
            data={'view_id': 'open', 'config': json.dumps({'basic_filters': []})},
            format='multipart'
        )
        request.user = project_creator

        seadb_api = Mock()

        def _list_my_portal_issues(_seadb, _project_uuid, _username, _state, _start, _limit, view_config):
            assert any(f.get('column_name') == 'creator' for f in view_config.get('basic_filters', []))
            return ([{'_pk': 1}], ['c1'])

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.list_my_portal_issues', side_effect=_list_my_portal_issues):
            resp = PortalMyIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['issues'][0]['_pk'] == 1


@pytest.mark.django_db
class TestPortalTagsView:

    def test_get_start_invalid(self, factory, project_creator, real_project):
        project = real_project
        _set_portal_settings(project, allow_anonymous=False)

        request = factory.get(f"/api/v1/portal/{project.uuid}/tags/", {'start': '-1'})
        request.user = project_creator

        resp = PortalTagsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        _set_portal_settings(project, allow_anonymous=False)

        request = factory.get(f"/api/v1/portal/{project.uuid}/tags/")
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.query_rows.return_value = {'metadata': {'columns': []}, 'results': [{'id': 1}]}

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api):
            resp = PortalTagsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['tags'][0]['id'] == 1


@pytest.mark.django_db
class TestPortalKnowledgeBaseViewsView:

    def test_get_feature_not_enabled(self, factory, project_creator, real_project):
        project = real_project
        _set_portal_settings(project, allow_anonymous=False, show_knowledge_base=False)

        request = factory.get(f"/api/v1/portal/{project.uuid}/knowledge-base/views/")
        request.user = project_creator

        resp = PortalKnowledgeBaseViewsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 403

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        _set_portal_settings(project, allow_anonymous=False, show_knowledge_base=True)

        request = factory.get(f"/api/v1/portal/{project.uuid}/knowledge-base/views/")
        request.user = project_creator

        with patch('seahub.portal.apis.KnowledgeBaseViews.objects.list_views', return_value=[{'_id': 'v1'}]):
            resp = PortalKnowledgeBaseViewsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data[0]['_id'] == 'v1'


@pytest.mark.django_db
class TestPortalKnowledgeBaseRecordsView:

    def test_get_missing_view_id(self, factory, project_creator, real_project):
        project = real_project
        _set_portal_settings(project, allow_anonymous=False, show_knowledge_base=True)

        request = factory.get(f"/api/v1/portal/{project.uuid}/knowledge-bases/")
        request.user = project_creator

        resp = PortalKnowledgeBaseRecordsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_get_feature_not_enabled(self, factory, project_creator, real_project):
        project = real_project
        _set_portal_settings(project, allow_anonymous=False, show_knowledge_base=False)

        request = factory.get(f"/api/v1/portal/{project.uuid}/knowledge-bases/", {'view_id': 'v1'})
        request.user = project_creator

        resp = PortalKnowledgeBaseRecordsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 403

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        _set_portal_settings(project, allow_anonymous=False, show_knowledge_base=True)

        request = factory.get(f"/api/v1/portal/{project.uuid}/knowledge-bases/", {'view_id': 'v1', 'start': 'a', 'limit': 'b'})
        request.user = project_creator

        seadb_api = Mock()
        view = Mock()

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.KnowledgeBaseViews.objects.get_view', return_value=view), \
                patch('seahub.portal.apis.list_knowledge_base_records', return_value=([{'_pk': 1}], ['c1'])):
            resp = PortalKnowledgeBaseRecordsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['records'][0]['_pk'] == 1


@pytest.mark.django_db
class TestPortalIssueMetadataView:

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        _set_portal_settings(project, allow_anonymous=False)

        request = factory.get(f"/api/v1/portal/{project.uuid}/issues/meta/")
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.get_base_metadata.return_value = {'tables': []}

        issue_meta = {
            'columns': [
                {'name': 'type', 'data': [{'id': 1}]},
                {'name': 'state', 'data': [{'id': 2}]},
                {'name': 'substate', 'data': [{'id': 3}]},
            ]
        }

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.get_current_table_metadata', return_value=issue_meta):
            resp = PortalIssueMetadataView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['types'][0]['id'] == 1
        assert resp.data['states'][0]['id'] == 2
        assert resp.data['substates'][0]['id'] == 3


@pytest.mark.django_db
class TestPortalSettingsView:

    def test_get_project_not_found(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        request = factory.get(f"/api/v1/portal/{project_uuid}/settings/")
        request.user = project_creator

        resp = PortalSettingsView.as_view()(request, project_uuid=project_uuid)

        assert resp.status_code == 404

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        _set_portal_settings(project, allow_anonymous=True, enable_password_protection=False, show_knowledge_base=True)

        request = factory.get(f"/api/v1/portal/{project.uuid}/settings/")
        request.user = project_creator

        resp = PortalSettingsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['allow_anonymous'] is True
        assert resp.data['show_knowledge_base'] is True

    def test_post_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.post(f"/api/v1/portal/{project.uuid}/settings/", data={'allow_anonymous': 1}, format='json')
        request.user = auth_user

        resp = PortalSettingsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 403

    def test_post_invalid_params(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/portal/{project.uuid}/settings/", data={'allow_anonymous': 'x'}, format='json')
        request.user = project_creator

        resp = PortalSettingsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_post_password_too_short(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/portal/{project.uuid}/settings/",
            data={'allow_anonymous': 1, 'enable_password_protection': 1, 'password': 'short'},
            format='json'
        )
        request.user = project_creator

        resp = PortalSettingsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_post_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/portal/{project.uuid}/settings/",
            data={'allow_anonymous': 1, 'enable_password_protection': 0, 'show_knowledge_base': 1},
            format='json'
        )
        request.user = project_creator

        resp = PortalSettingsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['success'] is True
        project.refresh_from_db()
        settings_dict = json.loads(project.settings) if project.settings else {}
        portal_settings = settings_dict.get('portal', {})
        assert portal_settings.get('allow_anonymous') is True
        assert portal_settings.get('enable_password_protection') is False
        assert portal_settings.get('show_knowledge_base') is True
        assert 'password' not in portal_settings


@pytest.mark.django_db
class TestPortalIssueTrashAPIView:

    def test_get_start_invalid(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/portal/{project.uuid}/portal-issues/trash/", {'start': '-1'})
        request.user = project_creator

        resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_get_limit_invalid(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/portal/{project.uuid}/portal-issues/trash/", {'limit': '-1'})
        request.user = project_creator

        resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/portal/{project.uuid}/portal-issues/trash/")
        request.user = project_creator

        seadb_api = Mock()
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.list_trash_portal_issues', return_value=([{'_pk': 1}], ['title'])), \
                patch('seahub.portal.apis.build_linked_ticket_titles_map', return_value={}):
            resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert 'issues' in resp.data

    def test_get_internal_error(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/portal/{project.uuid}/portal-issues/trash/")
        request.user = project_creator

        seadb_api = Mock()
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.list_trash_portal_issues', side_effect=Exception('boom')):
            resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 500

    def test_put_missing_issue_ids(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(f"/api/v1/portal/{project.uuid}/portal-issues/trash/", data={}, format='json')
        request.user = project_creator

        resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_put_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/portal/{project.uuid}/portal-issues/trash/",
            data={'issue_ids': [1, 2]},
            format='json'
        )
        request.user = project_creator

        seadb_api = Mock()
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api):
            resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['success'] is True
        seadb_api.update_rows.assert_called_once()

    def test_put_internal_error(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/portal/{project.uuid}/portal-issues/trash/",
            data={'issue_ids': [1]},
            format='json'
        )
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.update_rows.side_effect = Exception('boom')
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api):
            resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 500

    def test_delete_no_deleted_issues(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/portal/{project.uuid}/portal-issues/trash/", data={}, format='json')
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.query_rows.return_value = {'results': []}
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api):
            resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['success'] is True
        seadb_api.delete_rows.assert_not_called()

    def test_delete_success_without_linked_ticket(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/portal/{project.uuid}/portal-issues/trash/", data={}, format='json')
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.query_rows.return_value = {'results': [{'_pk': 1, 'linked_ticket': None}]}
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.delete_record_attachments_from_s3'):
            resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['success'] is True
        seadb_api.delete_rows.assert_called_once()

    def test_delete_success_with_linked_ticket(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/portal/{project.uuid}/portal-issues/trash/", data={}, format='json')
        request.user = project_creator

        seadb_api = Mock()
        # First call: query deleted portal issues
        # Second call: query comments delete (per issue)
        seadb_api.query_rows.side_effect = [
            {'results': [{'_pk': 1, 'linked_ticket': 10}]},
            {'results': []},  # comment delete for issue 1
        ]

        tickets = [{'_pk': 10, 'linked_connection_records': ['portal_1', '1_100']}]
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.delete_record_attachments_from_s3'), \
                patch('seahub.portal.apis.get_tickets_by_ids', return_value=tickets):
            resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['success'] is True
        # Should update tickets to remove portal_1 from linked_connection_records
        ticket_update_call = seadb_api.update_rows.call_args_list[0]
        update_row = ticket_update_call[0][2][0]
        assert update_row['pk'] == 10
        assert 'portal_1' not in update_row['row']['linked_connection_records']
        assert '1_100' in update_row['row']['linked_connection_records']
        seadb_api.delete_rows.assert_called_once()

    def test_delete_internal_error(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/portal/{project.uuid}/portal-issues/trash/", data={}, format='json')
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.query_rows.side_effect = Exception('boom')
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api):
            resp = PortalIssueTrashAPIView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 500


@pytest.mark.django_db
class TestPortalIssuesViewDelete:

    def test_delete_missing_issue_ids(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/portal/{project.uuid}/issues/", data={}, format='json')
        request.user = project_creator

        resp = PortalIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_delete_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(
            f"/api/v1/portal/{project.uuid}/issues/",
            data={'issue_ids': [1, 2]},
            format='json'
        )
        request.user = project_creator

        seadb_api = Mock()
        issues = [{'_pk': 1}, {'_pk': 2}]
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.get_portal_issues', return_value=issues):
            resp = PortalIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert resp.data['success'] == [1, 2]
        assert resp.data['failed'] == []
        seadb_api.update_rows.assert_called_once()

    def test_delete_partial_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(
            f"/api/v1/portal/{project.uuid}/issues/",
            data={'issue_ids': [1, 2, 3]},
            format='json'
        )
        request.user = project_creator

        seadb_api = Mock()
        # Only issue 1 and 3 exist
        issues = [{'_pk': 1}, {'_pk': 3}]
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.get_portal_issues', return_value=issues):
            resp = PortalIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert set(resp.data['success']) == {1, 3}
        assert resp.data['failed'] == [2]
        seadb_api.update_rows.assert_called_once()

    def test_delete_internal_error(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(
            f"/api/v1/portal/{project.uuid}/issues/",
            data={'issue_ids': [1]},
            format='json'
        )
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.query_rows.side_effect = Exception('boom')
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.get_portal_issues', side_effect=Exception('boom')):
            resp = PortalIssuesView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 500
