import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory

from seahub.billing.apis import BillingOrganizationAdditionalCredits


class BillingOrganizationAdditionalCreditsTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = BillingOrganizationAdditionalCredits.as_view()
        self.url = '/billing/api/organizations/123/additional-credits/'
        self.org = SimpleNamespace(org_id=123)

    @patch('seahub.billing.apis.redis.Redis')
    @patch.object(BillingOrganizationAdditionalCredits, '_validate_and_get_org')
    def test_post_success_publish_to_redis(self, mock_validate, mock_redis_cls):
        mock_validate.return_value = (self.org, None)
        redis_conn = Mock()
        mock_redis_cls.return_value = redis_conn

        request = self.factory.post(self.url, {'credits': 12.5}, format='json')
        response = self.view(request, org_id='123')

        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertTrue(response.data.get('success'))
        self.assertEqual(123, response.data.get('org_id'))
        self.assertEqual(12.5, response.data.get('credits'))
        self.assertIn('message_id', response.data)

        redis_conn.publish.assert_called_once()
        channel_name, message = redis_conn.publish.call_args.args
        payload = json.loads(message)

        self.assertEqual('add_additional_credits', payload['operation'])
        self.assertEqual(123, payload['org_id'])
        self.assertEqual(12.5, payload['credits'])
        self.assertIn('message_id', payload)
        self.assertIn('published_at', payload)
        self.assertEqual(response.data['message_id'], payload['message_id'])

    @patch('seahub.billing.apis.redis.Redis')
    @patch.object(BillingOrganizationAdditionalCredits, '_validate_and_get_org')
    def test_post_invalid_credits(self, mock_validate, mock_redis_cls):
        mock_validate.return_value = (self.org, None)

        request = self.factory.post(self.url, {'credits': 'bad-value'}, format='json')
        response = self.view(request, org_id='123')

        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn('credits invalid', str(response.data.get('error_msg', '')))
        mock_redis_cls.assert_not_called()

    @patch('seahub.billing.apis.redis.Redis')
    @patch.object(BillingOrganizationAdditionalCredits, '_validate_and_get_org')
    def test_post_redis_publish_error(self, mock_validate, mock_redis_cls):
        mock_validate.return_value = (self.org, None)
        mock_redis_cls.side_effect = RuntimeError('redis unavailable')

        request = self.factory.post(self.url, {'credits': 8.0}, format='json')
        response = self.view(request, org_id='123')

        self.assertEqual(status.HTTP_500_INTERNAL_SERVER_ERROR, response.status_code)
        self.assertIn('Failed to publish additional credits', str(response.data.get('error_msg', '')))
