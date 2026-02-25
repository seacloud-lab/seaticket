from unittest.mock import MagicMock, patch

import pytest

from seahub.project.tags import TagsAPIView, TagAPIView


@pytest.mark.django_db
class TestTagsAPIView:

    def test_get_feature_not_enabled(self, factory, auth_user, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.get(url)
        request.user = auth_user

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_get_start_invalid_returns_400(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.get(url, {'start': -1})
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_get_limit_invalid_returns_400(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.get(url, {'limit': -1})
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_get_project_not_found_returns_404(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        url = f"/api/v1/project/{project_uuid}/tags/"
        request = factory.get(url)
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project_uuid)

        assert resp.status_code == 404

    def test_get_permission_denied_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.get(url)
        request.user = no_org_user

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_get_seadb_error_returns_500(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.get(url)
        request.user = project_creator

        seadb = MagicMock()
        seadb.query_rows.side_effect = Exception('boom')

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 500

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.get(url)
        request.user = project_creator

        seadb = MagicMock()
        seadb.query_rows.return_value = {'metadata': [{'name': 'name'}], 'results': [{'_pk': 1}]}

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert 'tags' in resp.data
        assert 'columns' in resp.data

    def test_post_missing_name_returns_400(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.post(url, data={'color': '#fff', 'text_color': '#000'})
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_missing_color_returns_400(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.post(url, data={'name': 't1', 'text_color': '#000'})
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_missing_text_color_returns_400(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.post(url, data={'name': 't1', 'color': '#fff'})
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_project_not_found_returns_404(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        url = f"/api/v1/project/{project_uuid}/tags/"
        request = factory.post(url, data={'name': 't1', 'color': '#fff', 'text_color': '#000'})
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project_uuid)

        assert resp.status_code == 404

    def test_post_permission_denied_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.post(url, data={'name': 't1', 'color': '#fff', 'text_color': '#000'})
        request.user = no_org_user

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_post_seadb_error_returns_500(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.post(url, data={'name': 't1', 'color': '#fff', 'text_color': '#000'})
        request.user = project_creator

        seadb = MagicMock()
        seadb.insert_rows.side_effect = Exception('boom')

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 500

    def test_post_success_returns_201(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.post(url, data={'name': 't1', 'color': '#fff', 'text_color': '#000'})
        request.user = project_creator

        seadb = MagicMock()
        seadb.insert_rows.return_value = {'pks': [1]}

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 201
        assert 'tag' in resp.data

    def test_delete_missing_ids_returns_400(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.delete(url, data={}, format='json')
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_delete_invalid_ids_returns_400(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.delete(url, data={'tag_ids': ['x']}, format='json')
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_delete_project_not_found_returns_404(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        url = f'/api/v1/project/{project_uuid}/tags/'
        request = factory.delete(url, data={'tag_ids': [1]}, format='json')
        request.user = project_creator

        resp = TagsAPIView.as_view()(request, project_uuid=project_uuid)

        assert resp.status_code == 404

    def test_delete_permission_denied_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.delete(url, data={'tag_ids': [1]}, format='json')
        request.user = no_org_user

        resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_delete_seadb_error_returns_500(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.delete(url, data={'tag_ids': [1]}, format='json')
        request.user = project_creator

        seadb = MagicMock()
        seadb.delete_rows.side_effect = Exception('boom')

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 500

    def test_delete_success(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/'
        request = factory.delete(url, data={'tag_ids': [1]}, format='json')
        request.user = project_creator

        seadb = MagicMock()

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagsAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data['success'] is True


@pytest.mark.django_db
class TestTagAPIView:

    def test_get_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.get(url)
        request.user = no_org_user

        resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 403

    def test_get_project_not_found_returns_404(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        url = f'/api/v1/project/{project_uuid}/tags/1/'
        request = factory.get(url)
        request.user = project_creator

        resp = TagAPIView.as_view()(request, project_uuid=project_uuid, tag_id='1')

        assert resp.status_code == 404

    def test_get_permission_denied_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.get(url)
        request.user = no_org_user

        resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 403

    def test_get_tag_option_not_found_returns_404(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.get(url)
        request.user = project_creator

        seadb = MagicMock()
        seadb.get_base_metadata.return_value = {
            'tables': [
                {
                    'name': 'tickets',
                    'columns': [
                        {'name': 'tags', 'data': {'options': []}},
                    ],
                }
            ]
        }

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 404

    def test_get_seadb_error_returns_500(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.get(url)
        request.user = project_creator

        seadb = MagicMock()
        seadb.get_base_metadata.side_effect = Exception('boom')

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 500

    def test_get_success_returns_tickets(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.get(url)
        request.user = project_creator

        seadb = MagicMock()
        seadb.get_base_metadata.return_value = {
            'tables': [
                {
                    'name': 'tickets',
                    'columns': [
                        {'name': 'tags', 'data': {'options': [{'id': '1', 'name': 'Tag1'}]}},
                    ],
                }
            ]
        }

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.project.tags.filter_tickets_by_select', return_value=([{'_pk': 1}], [{'name': 'x'}])):
            resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 200
        assert 'tickets' in resp.data
        assert 'columns' in resp.data

    def test_put_argument_invalid_returns_400(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.put(url, data={}, format='json')
        request.user = project_creator

        resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 400

    def test_put_permission_denied_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.put(url, data={'name': 'x'}, format='json')
        request.user = no_org_user

        resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 403

    def test_put_seadb_error_returns_500(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.put(url, data={'name': 'x'}, format='json')
        request.user = project_creator

        seadb = MagicMock()
        seadb.update_rows.side_effect = Exception('boom')

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 500

    def test_put_success(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.put(url, data={'name': 'x'}, format='json')
        request.user = project_creator

        seadb = MagicMock()

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 200
        assert resp.data['success'] is True

    def test_delete_project_not_found_returns_404(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        url = f'/api/v1/project/{project_uuid}/tags/1/'
        request = factory.delete(url)
        request.user = project_creator

        resp = TagAPIView.as_view()(request, project_uuid=project_uuid, tag_id='1')

        assert resp.status_code == 404

    def test_delete_permission_denied_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.delete(url)
        request.user = no_org_user

        resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 403

    def test_delete_seadb_error_returns_500(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.delete(url)
        request.user = project_creator

        seadb = MagicMock()
        seadb.delete_rows.side_effect = Exception('boom')

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 500

    def test_delete_success(self, factory, project_creator, real_project):
        project = real_project
        url = f'/api/v1/project/{project.uuid}/tags/1/'
        request = factory.delete(url)
        request.user = project_creator

        seadb = MagicMock()

        with patch('seahub.project.tags.SeaDBAPI', return_value=seadb):
            resp = TagAPIView.as_view()(request, project_uuid=project.uuid, tag_id='1')

        assert resp.status_code == 200
        assert resp.data['success'] is True
