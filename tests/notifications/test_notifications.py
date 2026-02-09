from unittest.mock import Mock, MagicMock, patch
from seahub.notifications.models import UserNotification
from seahub.api2.endpoints.notifications import (
    NotificationsView,
    NotificationView,
    ProjectNotificationsView,
    ProjectNotificationView,
    NotificationsAllView,
)


class TestNotificationsView:

    def test_get_invalid_page(self, factory, auth_user):
        request = factory.get('/api2/notifications/', {'page': '0'})
        request.user = auth_user

        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 400

    def test_get_invalid_per_page(self, factory, auth_user):
        request = factory.get('/api2/notifications/', {'per_page': '0'})
        request.user = auth_user

        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 400
    
    def test_user_notifications(self, factory, auth_user, create_new_notification):
        new_notification = create_new_notification
        request = factory.get('/api2/notifications/')
        request.user = auth_user

        resp = NotificationsView.as_view()(request)

        assert resp.status_code == 200
        assert len(resp.data.get('notification_list')) == 1
        assert resp.data.get('count') == 1
        assert resp.data.get('unseen_count') == 1

        # test mark all as seen
        request = factory.put('/api2/notifications/')
        request.user = auth_user
        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 200
        assert resp.data.get('success') is True

        # verify unseen count becomes 0 by re-fetching
        request = factory.get('/api2/notifications/')
        request.user = auth_user
        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 200
        assert resp.data.get('unseen_count') == 0

        # test delete all notifications for current user
        request = factory.delete('/api2/notifications/')
        request.user = auth_user
        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 200
        assert resp.data['success'] is True

    def test_put_internal_error(self, factory, auth_user):
        request = factory.put('/api2/notifications/')
        request.user = auth_user

        with patch('seahub.api2.endpoints.notifications.UserNotification.objects.get_user_notifications', side_effect=Exception('boom')):
            resp = NotificationsView.as_view()(request)

        assert resp.status_code == 500

    def test_delete_internal_error(self, factory, auth_user):
        request = factory.delete('/api2/notifications/')
        request.user = auth_user

        with patch('seahub.api2.endpoints.notifications.UserNotification.objects.filter', side_effect=Exception('boom')):
            resp = NotificationsView.as_view()(request)

        assert resp.status_code == 500


class TestNotificationView:

    def test_user_notification(self, factory, auth_user, create_new_notification):
        new_notification = create_new_notification
        notice_id = new_notification.id
        request = factory.put(f'/api2/notifications/{notice_id}')
        request.user = auth_user

        resp = NotificationView.as_view()(request, notification_id=notice_id)
        assert resp.status_code == 200
        assert resp.data['success'] is True
                
        notice = UserNotification.objects.filter(to_user=auth_user.username, id=notice_id).first()
        assert notice.seen is True

    def test_put_not_found(self, factory, auth_user):
        request = factory.put('/api2/notifications/1/')
        request.user = auth_user

        class _DNE(Exception):
            pass

        with patch('seahub.api2.endpoints.notifications.UserNotification.DoesNotExist', _DNE), \
                patch('seahub.api2.endpoints.notifications.UserNotification.objects.get', side_effect=_DNE()):
            resp = NotificationView.as_view()(request, notification_id=1)

        assert resp.status_code == 404

    def test_put_seen_notice_no_save(self, factory, auth_user):
        request = factory.put('/api2/notifications/1/')
        request.user = auth_user

        notice = Mock()
        notice.seen = True

        with patch('seahub.api2.endpoints.notifications.UserNotification.objects.get', return_value=notice):
            resp = NotificationView.as_view()(request, notification_id=1)

        assert resp.status_code == 200
        notice.save.assert_not_called()


class TestProjectNotificationsView:

    def test_get_invalid_page(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api2/project/{project.uuid}/notifications/", {'page': '0'})
        request.user = auth_user

        resp = ProjectNotificationsView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 400

    def test_get_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api2/project/{project.uuid}/notifications/", {'page': '1', 'per_page': '2'})
        request.user = auth_user

        n1 = Mock()
        n1.to_dict.return_value = {'id': 1}
        n2 = Mock()
        n2.to_dict.return_value = {'id': 2}

        qs = MagicMock()
        qs.order_by.return_value = qs
        qs.count.return_value = 3
        qs.filter.return_value.count.return_value = 1
        qs.__getitem__.return_value = [n1, n2]

        with patch('seahub.api2.endpoints.notifications.ProjectNotification.objects.filter', return_value=qs):
            resp = ProjectNotificationsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data['count'] == 3
        assert resp.data['unseen_count'] == 1
        assert resp.data['notification_list'] == [{'id': 1}, {'id': 2}]

    def test_put_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(f"/api2/project/{project.uuid}/notifications/")
        request.user = auth_user

        with patch('seahub.api2.endpoints.notifications.ProjectNotification.objects.mark_all_read_by_project') as m:
            resp = ProjectNotificationsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data['success'] is True
        m.assert_called_once_with(project.uuid, auth_user.username)

    def test_put_internal_error(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(f"/api2/project/{project.uuid}/notifications/")
        request.user = auth_user

        with patch('seahub.api2.endpoints.notifications.ProjectNotification.objects.mark_all_read_by_project', side_effect=Exception('boom')):
            resp = ProjectNotificationsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 500


class TestProjectNotificationView:

    def test_put_not_found(self, factory, auth_user):
        request = factory.put('/api2/project/notifications/1/')
        request.user = auth_user

        with patch('seahub.api2.endpoints.notifications.ProjectNotification.objects.mark_as_read', return_value=None):
            resp = ProjectNotificationView.as_view()(request, notification_id=1)

        assert resp.status_code == 404

    def test_put_success(self, factory, auth_user):
        request = factory.put('/api2/project/notifications/1/')
        request.user = auth_user

        with patch('seahub.api2.endpoints.notifications.ProjectNotification.objects.mark_as_read', return_value=Mock()):
            resp = ProjectNotificationView.as_view()(request, notification_id=1)

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestNotificationsAllView:

    def test_get_invalid_page(self, factory, auth_user):
        request = factory.get('/api2/notifications/all/', {'page': '0'})
        request.user = auth_user

        resp = NotificationsAllView.as_view()(request)
        assert resp.status_code == 400

    def test_get_success(self, factory, auth_user):
        request = factory.get('/api2/notifications/all/', {'page': '1', 'per_page': '1'})
        request.user = auth_user

        # user notifications
        un1 = Mock()
        un1.detail = {'a': 1}
        un1.to_dict.return_value = {'id': 1}

        user_qs_all = MagicMock()
        user_qs_all.__getitem__.return_value = [un1]
        user_qs_all.count.return_value = 1
        user_qs_unseen = Mock()
        user_qs_unseen.count.return_value = 2

        # projects
        active_projects = Mock()
        active_projects.values_list.return_value = ['p1']
        active_projects.filter.return_value = [Mock(uuid='p1', project_name='P', workspace_id=1, icon='i', color='c')]

        # project notifications
        project_stats = [{'project_uuid': 'p1', 'count': 3, 'unseen_count': 1, 'last_timestamp': 1}]

        class _ProjectStatsQS(list):
            def values(self, *args, **kwargs):
                return self
            def annotate(self, *args, **kwargs):
                return self
            def order_by(self, *args, **kwargs):
                return self
            def count(self):
                return 3

        proj_qs = _ProjectStatsQS(project_stats)

        proj_unseen_qs = proj_qs

        def _get_user_notifications(username, seen=None):
            if seen is False:
                return user_qs_unseen
            return user_qs_all

        def _project_filter(*args, **kwargs):
            if kwargs.get('seen') is False:
                return proj_unseen_qs
            return proj_qs

        with patch('seahub.api2.endpoints.notifications.UserNotification.objects.get_user_notifications', side_effect=_get_user_notifications), \
                patch('seahub.api2.endpoints.notifications.Projects.objects.filter', return_value=active_projects), \
                patch('seahub.api2.endpoints.notifications.ProjectNotification.objects.filter', side_effect=_project_filter):
            resp = NotificationsAllView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['general']['count'] == 1
        assert resp.data['general']['unseen_count'] == 2
        assert resp.data['project']['unseen_count'] == 3
        assert resp.data['total_unseen_count'] == 5
        assert resp.data['project']['project_list'][0]['project_name'] == 'P'
