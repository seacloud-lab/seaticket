from seahub.notifications.models import UserNotification, ProjectNotification
from seahub.api2.endpoints.notifications import (
    NotificationsView,
    NotificationView,
    ProjectNotificationsView,
    ProjectNotificationView,
    NotificationsAllView,
)


class TestNotificationsView:

    def test_get_invalid_page(self, factory, project_creator):
        request = factory.get('/api2/notifications/', {'page': '0'})
        request.user = project_creator

        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 400

    def test_get_invalid_per_page(self, factory, project_creator):
        request = factory.get('/api2/notifications/', {'per_page': '0'})
        request.user = project_creator

        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 400
    
    def test_user_notifications(self, factory, project_creator, create_new_notification):
        new_notification = create_new_notification
        request = factory.get('/api2/notifications/')
        request.user = project_creator

        resp = NotificationsView.as_view()(request)

        assert resp.status_code == 200
        assert len(resp.data.get('notification_list')) == 1
        assert resp.data.get('count') == 1
        assert resp.data.get('unseen_count') == 1

        # test mark all as seen
        request = factory.put('/api2/notifications/')
        request.user = project_creator
        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 200
        assert resp.data.get('success') is True

        # verify unseen count becomes 0 by re-fetching
        request = factory.get('/api2/notifications/')
        request.user = project_creator
        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 200
        assert resp.data.get('unseen_count') == 0

        # test delete all notifications for current user
        request = factory.delete('/api2/notifications/')
        request.user = project_creator
        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 200
        assert resp.data['success'] is True

    def test_put_success_no_notifications(self, factory, project_creator):
        request = factory.put('/api2/notifications/')
        request.user = project_creator

        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 200
        assert resp.data.get('success') is True

    def test_delete_success_no_notifications(self, factory, project_creator):
        request = factory.delete('/api2/notifications/')
        request.user = project_creator

        resp = NotificationsView.as_view()(request)
        assert resp.status_code == 200
        assert resp.data.get('success') is True


class TestNotificationView:

    def test_user_notification(self, factory, project_creator, create_new_notification):
        new_notification = create_new_notification
        notice_id = new_notification.id
        request = factory.put(f'/api2/notifications/{notice_id}')
        request.user = project_creator

        resp = NotificationView.as_view()(request, notification_id=notice_id)
        assert resp.status_code == 200
        assert resp.data['success'] is True
                
        notice = UserNotification.objects.filter(to_user=project_creator.username, id=notice_id).first()
        assert notice.seen is True

    def test_put_not_found(self, factory, project_creator):
        request = factory.put('/api2/notifications/1/')
        request.user = project_creator

        resp = NotificationView.as_view()(request, notification_id=1)
        assert resp.status_code == 404

    def test_put_seen_notice_no_change(self, factory, project_creator, seen_user_notification):
        request = factory.put(f'/api2/notifications/{seen_user_notification.id}/')
        request.user = project_creator

        resp = NotificationView.as_view()(request, notification_id=seen_user_notification.id)
        assert resp.status_code == 200
        seen_user_notification.refresh_from_db()
        assert seen_user_notification.seen is True


class TestProjectNotificationsView:

    def test_get_invalid_page(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api2/project/{project.uuid}/notifications/", {'page': '0'})
        request.user = project_creator

        resp = ProjectNotificationsView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 400

    def test_get_success(self, factory, project_creator, real_project, project_notifications_mixed):
        project = real_project
        request = factory.get(f"/api2/project/{project.uuid}/notifications/", {'page': '1', 'per_page': '2'})
        request.user = project_creator

        resp = ProjectNotificationsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data['count'] == 3
        assert resp.data['unseen_count'] == 1
        assert len(resp.data['notification_list']) == 2
        all_ids = set(ProjectNotification.objects.filter(
            project_uuid=str(project.uuid),
            to_user=project_creator.username,
        ).values_list('id', flat=True))
        assert {item['id'] for item in resp.data['notification_list']}.issubset(all_ids)

    def test_put_success(self, factory, project_creator, real_project, project_notifications_unseen):
        project = real_project
        request = factory.put(f"/api2/project/{project.uuid}/notifications/")
        request.user = project_creator

        resp = ProjectNotificationsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert ProjectNotification.objects.filter(
            project_uuid=str(project.uuid),
            to_user=project_creator.username,
            seen=False,
        ).count() == 0


class TestProjectNotificationView:

    def test_put_not_found(self, factory, project_creator):
        request = factory.put('/api2/project/notifications/1/')
        request.user = project_creator

        resp = ProjectNotificationView.as_view()(request, notification_id=1)
        assert resp.status_code == 404

    def test_put_success(self, factory, project_creator, real_project, project_notifications_unseen):
        request = factory.put('/api2/project/notifications/1/')
        request.user = project_creator

        notice = project_notifications_unseen[0]
        resp = ProjectNotificationView.as_view()(request, notification_id=notice.id)

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestNotificationsAllView:

    def test_get_invalid_page(self, factory, project_creator):
        request = factory.get('/api2/notifications/all/', {'page': '0'})
        request.user = project_creator

        resp = NotificationsAllView.as_view()(request)
        assert resp.status_code == 400

    def test_get_success(self, factory, project_creator, real_project, notifications_all_data):
        request = factory.get('/api2/notifications/all/', {'page': '1', 'per_page': '1'})
        request.user = project_creator

        resp = NotificationsAllView.as_view()(request)
        assert resp.status_code == 200
        assert resp.data['general']['count'] == 2
        assert resp.data['general']['unseen_count'] == 2
        assert resp.data['project']['unseen_count'] == 3
        assert resp.data['total_unseen_count'] == 5
        assert resp.data['project']['project_list'][0]['project_name'] == real_project.project_name
