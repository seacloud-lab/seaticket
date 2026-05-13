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

    @patch('seahub.billing.apis.connection.cursor')
    @patch('seahub.billing.apis.transaction.atomic')
    @patch.object(BillingOrganizationAdditionalCredits, '_validate_and_get_org')
    def test_post_success_add_to_database(self, mock_validate, mock_atomic, mock_cursor):
        mock_validate.return_value = (self.org, None)
        mock_atomic.return_value.__enter__.return_value = None
        mock_atomic.return_value.__exit__.return_value = None
        cursor = Mock()
        mock_cursor.return_value.__enter__.return_value = cursor
        mock_cursor.return_value.__exit__.return_value = None

        request = self.factory.post(self.url, {
            'credits': 12.5,
            'stripe_session_id': 'cs_test_abc123',
        }, format='json')
        response = self.view(request, org_id='123')

        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertTrue(response.data.get('success'))
        self.assertEqual(123, response.data.get('org_id'))
        self.assertEqual(12.5, response.data.get('credits'))
        mock_cursor.assert_called_once()
        self.assertEqual(cursor.execute.call_count, 2)
        sql, params = cursor.execute.call_args.args
        self.assertIn('INSERT INTO additional_credits', sql)
        self.assertEqual([123, 12.5], params)

    @patch.object(BillingOrganizationAdditionalCredits, '_validate_and_get_org')
    def test_post_invalid_credits(self, mock_validate):
        mock_validate.return_value = (self.org, None)

        request = self.factory.post(self.url, {'credits': 'bad-value'}, format='json')
        response = self.view(request, org_id='123')

        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn('credits invalid', str(response.data.get('error_msg', '')))
        self.assertEqual(response.data.get('error_msg'), 'credits invalid.')

    @patch('seahub.billing.apis.connection.cursor')
    @patch('seahub.billing.apis.transaction.atomic')
    @patch.object(BillingOrganizationAdditionalCredits, '_validate_and_get_org')
    def test_post_db_error(self, mock_validate, mock_atomic, mock_cursor):
        mock_validate.return_value = (self.org, None)
        mock_atomic.return_value.__enter__.return_value = None
        mock_atomic.return_value.__exit__.return_value = None
        mock_cursor.return_value.__enter__.side_effect = RuntimeError('db unavailable')
        mock_cursor.return_value.__exit__.return_value = None

        request = self.factory.post(self.url, {
            'credits': 8.0,
            'stripe_session_id': 'cs_test_db_error',
        }, format='json')
        response = self.view(request, org_id='123')

        self.assertEqual(status.HTTP_500_INTERNAL_SERVER_ERROR, response.status_code)
        self.assertIn('Failed to add additional credits', str(response.data.get('error_msg', '')))
