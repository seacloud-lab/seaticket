from django.urls import reverse
from seahub.dtable.models import DTableSystemPlugins, DTablePluginsInstallCount

from seahub.test_utils import BaseTestCase


class DTablePluginsInstallCountViewTest(BaseTestCase):

    def setUp(self):
        DTableSystemPlugins.objects.create(name='test')

        self.url = reverse('api-v2.1-plugins-install-count')

    def tearDown(self):
        DTableSystemPlugins.objects.all().delete()
        DTablePluginsInstallCount.objects.all().delete()

    def test_plugin_install_count(self):
        self.login_as(self.admin)
        resp = self.client.post(self.url, {'plugin_name': 'test'})
        self.assertEqual(200, resp.status_code)
        install_plugin = DTablePluginsInstallCount.objects.filter(plugin_name='test').first()
        self.assertIsNotNone(install_plugin)
        self.assertEqual(1, install_plugin.count)
        resp = self.client.post(self.url, {'plugin_name': 'test-test'})
        self.assertEqual(404, resp.status_code)
