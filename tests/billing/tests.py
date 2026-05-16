import time
import uuid

import jwt

from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.conf import settings
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIRequestFactory

from seahub.billing.apis import BillingOrganizationAdditionalCredits, \
        BillingOrganizationOperation, get_org_info

JWT_SECRET = 'test-jwt-secret-for-billing'
JWT_ALGO = 'HS256'
JWT_ISSUER = 'pay.seaticket.ai'
JWT_AUDIENCE = 'seaqa-web'


def _generate_valid_jwt():
    """Generate a valid JWT token for testing (unified iss/aud/exp/jti/org_id format)."""
    now = int(time.time())
    payload = {
        'iss': JWT_ISSUER,
        'aud': JWT_AUDIENCE,
        'exp': now + 3600,
        'jti': str(uuid.uuid4()),
        'org_id': 123,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def _generate_expired_jwt():
    """Generate an expired JWT token for testing (unified iss/aud/exp/jti/org_id format)."""
    now = int(time.time())
    payload = {
        'iss': JWT_ISSUER,
        'aud': JWT_AUDIENCE,
        'exp': now - 3600,
        'jti': str(uuid.uuid4()),
        'org_id': 123,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


class BillingOrganizationAdditionalCreditsTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = BillingOrganizationAdditionalCredits.as_view()
        self.url = '/billing/api/organizations/123/additional-credits/'
        self.org = SimpleNamespace(org_id=123)
        self.valid_jwt = _generate_valid_jwt()

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


class BillingJwtAuthTests(TestCase):
    """Tests specifically for JWT authentication in billing APIs."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.valid_jwt = _generate_valid_jwt()
        self.expired_jwt = _generate_expired_jwt()

    @patch('seahub.billing.apis.get_service_url', Mock(return_value='https://seaqa-web'))
    @patch('seahub.billing.apis.BILLING_SERVICE_URL', 'https://pay.seaticket.ai')
    @patch('seahub.billing.apis.MULTI_TENANCY', True)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_SECRET_KEY', JWT_SECRET)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_ALGORITHM', JWT_ALGO)
    def test_valid_jwt_token_passes_auth(self):
        """Test that a valid JWT token passes authentication."""
        view = BillingOrganizationOperation()
        request = self.factory.get('/fake-url/')
        request.META = {'HTTP_AUTHORIZATION': f'Bearer {self.valid_jwt}'}

        org, error = view._validate_and_get_org(request, 'abc')
        # org_id 'abc' is invalid, so org will be None with 400
        self.assertIsNone(org)
        self.assertEqual(error.status_code, 400)

    @patch('seahub.billing.apis.MULTI_TENANCY', True)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_SECRET_KEY', JWT_SECRET)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_ALGORITHM', JWT_ALGO)
    def test_expired_jwt_token_rejected(self):
        """Test that an expired JWT token is rejected."""
        view = BillingOrganizationOperation()
        request = self.factory.get('/fake-url/')
        request.META = {'HTTP_AUTHORIZATION': f'Bearer {self.expired_jwt}'}

        org, error = view._validate_and_get_org(request, '123')

        self.assertIsNone(org)
        self.assertEqual(error.status_code, 403)

    @patch('seahub.billing.apis.MULTI_TENANCY', True)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_SECRET_KEY', JWT_SECRET)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_ALGORITHM', JWT_ALGO)
    def test_invalid_jwt_token_rejected(self):
        """Test that an invalid JWT token is rejected."""
        view = BillingOrganizationOperation()
        request = self.factory.get('/fake-url/')
        request.META = {'HTTP_AUTHORIZATION': 'Bearer invalid-jwt-token-here'}

        org, error = view._validate_and_get_org(request, '123')

        self.assertIsNone(org)
        self.assertEqual(error.status_code, 403)

    def test_no_auth_header_rejected(self):
        """Test that missing Authorization header is rejected."""
        view = BillingOrganizationOperation()
        request = self.factory.get('/fake-url/')
        request.META = {}

        org, error = view._validate_and_get_org(request, '123')

        self.assertIsNone(org)
        self.assertEqual(error.status_code, 403)

    def test_auth_header_only_prefix_rejected(self):
        """Test that Authorization header with only prefix is rejected."""
        view = BillingOrganizationOperation()
        request = self.factory.get('/fake-url/')
        request.META = {'HTTP_AUTHORIZATION': 'Bearer'}

        org, error = view._validate_and_get_org(request, '123')

        self.assertIsNone(org)
        self.assertEqual(error.status_code, 403)

    @patch('seahub.billing.apis.MULTI_TENANCY', True)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_SECRET_KEY', JWT_SECRET)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_ALGORITHM', JWT_ALGO)
    def test_auth_header_with_spaces_rejected(self):
        """Test that Authorization header with spaces in token is rejected."""
        view = BillingOrganizationOperation()
        request = self.factory.get('/fake-url/')
        request.META = {'HTTP_AUTHORIZATION': f'Bearer {self.valid_jwt} extra'}

        org, error = view._validate_and_get_org(request, '123')

        self.assertIsNone(org)
        self.assertEqual(error.status_code, 403)

    @patch('seahub.billing.apis.get_service_url', Mock(return_value='https://seaqa-web'))
    @patch('seahub.billing.apis.BILLING_SERVICE_URL', 'https://pay.seaticket.ai')
    @patch('seahub.billing.apis.MULTI_TENANCY', True)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_SECRET_KEY', JWT_SECRET)
    @patch('seahub.billing.apis.BILLING_SERVICE_JWT_ALGORITHM', JWT_ALGO)
    def test_token_auth_prefix_also_accepted(self):
        """Test that 'Token' prefix (Bearer equivalent) is also accepted by AUTHORIZATION_PREFIX."""
        view = BillingOrganizationOperation()
        request = self.factory.get('/fake-url/')
        request.META = {'HTTP_AUTHORIZATION': f'Token {self.valid_jwt}'}

        org, error = view._validate_and_get_org(request, 'abc')
        # org_id 'abc' is invalid
        self.assertIsNone(org)
        self.assertEqual(error.status_code, 400)
