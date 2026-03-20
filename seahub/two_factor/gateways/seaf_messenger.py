# Copyright (c) 2012-2016 Seafile Ltd.
import logging

logger = logging.getLogger(__name__)


class SeafMessenger(object):
    @staticmethod
    def make_call(device, token):
        logger.info('Fake call to %s: "Your token is: %s"', device.number, token)
