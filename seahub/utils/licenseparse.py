# Copyright (c) 2012-2016 Seafile Ltd.
import logging
from django.conf import settings
from seahub.base.accounts import User

logger = logging.getLogger(__name__)


def get_license_path():
    return settings.LICENSE_PATH


def parse_license():
    """Parse license file and return dict.

    Arguments:
    - `license_path`:

    Returns:
    e.g.

    {'Hash': 'fdasfjl',
    'Name': 'seafile official',
    'Licencetype': 'User',
    'LicenceKEY': '123',
    'Expiration': '2016-3-2',
    'MaxUsers': '1000000',
    'ProductID': 'Seafile server for Windows'
    }

    """
    ret = {}
    lines = []
    try:
        with open(get_license_path()) as f:
            lines = f.readlines()
    except Exception as e:
        logger.warn(e)
        return {}

    for line in lines:
        if len(line.split('=')) == 2:
            k, v = line.split('=')
            ret[k.strip()] = v.strip().strip('"')

    return ret


def user_number_over_limit(new_users=1):
    logger = logging.getLogger(__name__)
    try:
        max_users = 1000000

        # get active user number
        active_users = User.objects.count_emailusers()

        if new_users < 0:
            logger.debug('`new_users` must be greater or equal to 0.')
            return False
        else:
            return active_users + new_users > max_users

    except Exception as e:
        logger.error(e)
        return False
