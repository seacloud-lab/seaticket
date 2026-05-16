# Copyright (c) 2012-2016 Seafile Ltd.
import logging
import jwt

from datetime import datetime, timezone
from urllib.parse import urlparse

from django.db import transaction, connection
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle

from seahub.utils.auth import AUTHORIZATION_PREFIX
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.utils import get_service_url

from seahub.organizations.signals import org_role_updated
from seahub.organizations.models import Organization, OrgSettings

from seahub.role_permissions.utils import get_available_roles
from seahub.base.templatetags.seahub_tags import email2nickname, \
        email2contact_email

from seahub.settings import BILLING_SERVICE_JWT_SECRET_KEY, BILLING_SERVICE_JWT_ALGORITHM, MULTI_TENANCY
from seahub.billing.settings import BILLING_SERVICE_URL
from seahub.project.models import AdditionalCreditsStripeSession

logger = logging.getLogger(__name__)


def get_org_info(org):
    org_id = org.org_id

    org_info = {}
    org_info['org_id'] = org_id
    org_info['org_name'] = org.org_name
    org_info['ctime'] = timestamp_to_isoformat_timestr(org.ctime)
    org_info['role'] = OrgSettings.objects.get_role_by_org(org)

    creator = org.creator
    org_info['creator_email'] = creator
    org_info['creator_name'] = email2nickname(creator)
    org_info['creator_contact_email'] = email2contact_email(creator)

    return org_info


class BillingOrganizationOperation(APIView):

    throttle_classes = (UserRateThrottle,)

    def _validate_and_get_org(self, request, org_id):

        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX:
            error_msg = 'Invalid token header. No credentials provided.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if len(auth) == 1:
            error_msg = 'Invalid token header. No credentials provided.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if len(auth) > 2:
            error_msg = 'Invalid token header. Token string should not contain spaces.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        jwt_token = auth[1]

        # Resolve expected issuer (pay.seaticket.ai) and audience (seaqa-web) domains
        billing_parsed = urlparse(BILLING_SERVICE_URL) if BILLING_SERVICE_URL else None
        billing_domain = billing_parsed.netloc.split(':')[0] if billing_parsed else ''

        seaticket_service_url = get_service_url()
        seaticket_parsed = urlparse(seaticket_service_url) if seaticket_service_url else None
        seaticket_domain = seaticket_parsed.netloc.split(':')[0] if seaticket_parsed else ''

        try:
            jwt.decode(
                jwt_token,
                BILLING_SERVICE_JWT_SECRET_KEY,
                algorithms=[BILLING_SERVICE_JWT_ALGORITHM],
                issuer=billing_domain,
                audience=seaticket_domain,
                options={'require': ['exp', 'iss', 'aud', 'jti']},
            )
        except jwt.ExpiredSignatureError:
            error_msg = 'JWT token has expired.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)
        except jwt.InvalidTokenError as e:
            logger.error('JWT token validation error: %s', e)
            error_msg = 'Invalid JWT token.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not MULTI_TENANCY:
            error_msg = 'Feature is not enabled.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            org_id = int(org_id)
        except ValueError:
            error_msg = 'org_id invalid.'
            return None, api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if org_id == 0:
            error_msg = 'org_id invalid.'
            return None, api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %s not found.' % org_id
            return None, api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return org, None

    def get(self, request, org_id):
        """ Get base info of a organization

        Permission checking:
        1. only admin can perform this action.
        """
        org, error = self._validate_and_get_org(request, org_id)
        if error:
            return error

        org_info = get_org_info(org)
        return Response(org_info)

    def put(self, request, org_id):
        """ Update base info of a organization

        Permission checking:
        1. only admin can perform this action.
        """
        org, error = self._validate_and_get_org(request, org_id)
        if error:
            return error

        role = request.data.get('role')
        if role:
            if role not in get_available_roles():
                error_msg = 'Role %s invalid.' % role
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            OrgSettings.objects.add_or_update(org, role=role)
            org_role_updated.send(None, org_id=org_id)

        org_info = get_org_info(org)
        return Response(org_info)


class BillingOrganizationAdditionalCredits(BillingOrganizationOperation):

    def post(self, request, org_id):
        org, error = self._validate_and_get_org(request, org_id)
        if error:
            return error

        credits = request.data.get('credits')
        stripe_session_id = request.data.get('stripe_session_id', '')

        try:
            credits = float(credits)
        except (TypeError, ValueError):
            return api_error(status.HTTP_400_BAD_REQUEST, 'credits invalid.')

        if credits <= 0:
            return api_error(status.HTTP_400_BAD_REQUEST, 'credits invalid.')

        org_id_int = int(org.org_id)

        # Idempotency: use stripe_session_id to prevent duplicate credit additions
        if stripe_session_id:
            try:
                with transaction.atomic():
                    with connection.cursor() as cursor:
                        # Try to insert the session record; if it already exists (duplicate key),
                        # this is a retry from Stripe and we skip adding credits.
                        cursor.execute('''
                            INSERT IGNORE INTO additional_credits_stripe_sessions
                                (stripe_session_id, org_id, created_at)
                            VALUES (%s, %s, NOW())
                        ''', [stripe_session_id, org_id_int])

                        if cursor.rowcount == 0:
                            logger.info(
                                'Stripe session %s already processed for org_id=%s, skipping duplicate credits',
                                stripe_session_id, org_id_int
                            )
                            return Response({
                                'success': True,
                                'org_id': org_id_int,
                                'credits': credits,
                                'already_processed': True,
                            })

                        # New session: add credits
                        cursor.execute('''
                            INSERT INTO additional_credits (org_id, credits, updated_at)
                            VALUES (%s, %s, NOW())
                            ON DUPLICATE KEY UPDATE
                                credits = credits + VALUES(credits),
                                updated_at = VALUES(updated_at)
                        ''', [org_id_int, credits])
            except Exception as e:
                logger.error(
                    'Failed to add additional credits to db, org_id=%s credits=%s stripe_session_id=%s error=%s',
                    org_id_int, credits, stripe_session_id, e
                )
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to add additional credits.')
        else:
            return api_error(status.HTTP_400_BAD_REQUEST, 'stripe_session_id is required.')

        return Response({
            'success': True,
            'org_id': org_id_int,
            'credits': credits,
        })
