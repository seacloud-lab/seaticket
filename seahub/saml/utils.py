# -*- coding: utf-8 -*-
import re
import copy
import logging
from os import path

from seahub.constants import SAML_ATTRIBUTE_MAPPING, SAML_CERTS_DIR

import saml2.xmldsig
from saml2 import BINDING_HTTP_REDIRECT, BINDING_HTTP_POST, NAMEID_FORMAT_EMAILADDRESS
from saml2.config import SPConfig
from django.utils.translation import gettext as _

from seahub.utils import get_service_url
from seahub.organizations.models import OrgSAMLConfig, Organization
from seahub import settings

logger = logging.getLogger(__name__)

ENABLE_SAML = getattr(settings, 'ENABLE_SAML', False)
ENABLE_MULTI_SAML = getattr(settings, 'ENABLE_MULTI_SAML', False)
if ENABLE_SAML or ENABLE_MULTI_SAML:
    REMOTE_METADATA_URL = getattr(settings, 'SAML_REMOTE_METADATA_URL', '')
    XMLSEC_BINARY_PATH = getattr(settings, 'SAML_XMLSEC_BINARY_PATH', '/usr/bin/xmlsec1')
    CERTS_DIR = getattr(settings, 'SAML_CERTS_DIR', SAML_CERTS_DIR)
    SAML_ATTRIBUTE_MAPPING = getattr(settings, 'SAML_ATTRIBUTE_MAPPING', SAML_ATTRIBUTE_MAPPING)
    SAML_PROVIDER_IDENTIFIER = getattr(settings, 'SAML_PROVIDER_IDENTIFIER', 'saml')


def settings_check(func):
    def _decorated(request):
        error = False
        if not ENABLE_SAML and not ENABLE_MULTI_SAML:
            logger.error('Feature not enabled.')
            error = True
        else:
            if not XMLSEC_BINARY_PATH or not CERTS_DIR or not SAML_ATTRIBUTE_MAPPING or not SAML_PROVIDER_IDENTIFIER:
                logger.error('SAML login relevant settings invalid.')
                logger.error('SAML_XMLSEC_BINARY_PATH: %s' % XMLSEC_BINARY_PATH)
                logger.error('SAML_CERTS_DIR: %s' % CERTS_DIR)
                logger.error('SAML_ATTRIBUTE_MAPPING: %s' % SAML_ATTRIBUTE_MAPPING)
                logger.error('SAML_PROVIDER_IDENTIFIER: %s' % SAML_PROVIDER_IDENTIFIER)
                error = True
            if ENABLE_SAML and not REMOTE_METADATA_URL:
                logger.error('SAML relevant settings invalid.')
                logger.error('SAML_REMOTE_METADATA_URL: %s' % REMOTE_METADATA_URL)
                error = True
        if error:
            raise Exception(_('SAML login relevant settings invalid.'))
        return func(request)
    return _decorated


@settings_check
def config_settings_loader(request):
    # get org_id
    org_id = None
    reg = re.search(r'org/custom/(\d+)/saml/', request.path)
    if reg:
        org_id = int(reg.group(1))

    if org_id and org_id > 0:
        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            raise Exception('Cannot find an organization related to org_id %s.' % org_id)

        org_saml_config = OrgSAMLConfig.objects.get_config_by_org_id(org_id)
        if not org_saml_config:
            raise Exception('Failed to get org %s saml_config' % org_id)

        # get org remote_metadata_url
        remote_metadata_url = org_saml_config.metadata_url
        # get org sp_service_url
        sp_service_url = get_service_url().rstrip('/') + '/org/custom/' + str(org_id)
    else:
        # get remote_metadata_url
        remote_metadata_url = REMOTE_METADATA_URL
        # get sp_service_url
        sp_service_url = get_service_url().rstrip('/')

    # generate org saml_config
    saml_config = {
        'entityid': sp_service_url + '/saml/metadata/',
        'xmlsec_binary': XMLSEC_BINARY_PATH,
        'attribute_map_dir': path.join(path.dirname(path.abspath(__file__)), 'attribute-maps'),
        'allow_unknown_attributes': True,
        'service': {
            'sp': {
                'name_id_format': NAMEID_FORMAT_EMAILADDRESS,
                'required_attributes': ['uid'],
                'allow_unsolicited': True,
                # https://github.com/IdentityPython/pysaml2/blob/master/docs/howto/config.rst#want-assertions-or-response-signed
                'want_response_signed': False,
                'want_assertions_signed': False,
                'want_assertions_or_response_signed': True,

                # ADFS single logout must be signed
                'logout_requests_signed': True,

                # The sha1 algorithm is used by default, but sha256 is recommended
                # https://github.com/IdentityPython/pysaml2/blob/master/src/saml/xmldsig/__init__.py#L49
                # https://djangosaml2.readthedocs.io/contents/setup.html#pysaml2-specific-files-and-configuration
                'signing_algorithm': saml2.xmldsig.SIG_RSA_SHA256,
                'digest_algorithm': saml2.xmldsig.DIGEST_SHA256,

                'endpoints': {
                    'assertion_consumer_service': [
                        (sp_service_url + '/saml/acs/', BINDING_HTTP_POST)
                    ],
                    'single_logout_service': [
                        (sp_service_url + '/saml/ls/', BINDING_HTTP_REDIRECT),
                        (sp_service_url + '/saml/ls/post/', BINDING_HTTP_POST),
                    ],
                },
            },
        },
        'metadata': {
            'remote': [{'url': remote_metadata_url}],
        },

        # https://djangosaml2.readthedocs.io/contents/setup.html#certificates
        'key_file': path.join(CERTS_DIR, 'sp.key'),
        'cert_file': path.join(CERTS_DIR, 'sp.crt'),
        'encryption_keypairs': [{
            'key_file': path.join(CERTS_DIR, 'sp.key'),
            'cert_file': path.join(CERTS_DIR, 'sp.crt'),
        }],
    }

    conf = SPConfig()
    try:
        conf.load(copy.deepcopy(saml_config))
    except Exception as e:
        logger.exception('Failed to load ADFS/SAML config, error: %s' % e)
        raise RuntimeError('Failed to load ADFS/SAML config, error: %s' % e)
    return conf
