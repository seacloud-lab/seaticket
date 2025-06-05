#!/usr/bin/env python
#coding=utf-8

import logging
import json
from aliyunsdkcore.client import AcsClient
from aliyunsdkcore.request import CommonRequest

from seahub.settings import ALIYUN_SMS_CONFIG

logger = logging.getLogger(__name__)


class AliyunSmsClient:
    def __new__(cls, *args, **kwargs):
        if not hasattr(cls, '__instance__'):
            setattr(cls, '__instance__', super().__new__(cls))
        return getattr(cls, '__instance__')

    def __init__(self):
        if not hasattr(self, '_client'):
            self._client = AcsClient(
                ak=ALIYUN_SMS_CONFIG['accessKeyId'],
                secret=ALIYUN_SMS_CONFIG['accessKeySecret'],
                region_id=ALIYUN_SMS_CONFIG.get('regionId'))

    def send_verify_code(self, phone, code):
        request = CommonRequest()
        request.set_accept_format('json')
        request.set_domain('dysmsapi.aliyuncs.com')
        request.set_method('POST')
        request.set_protocol_type('https')
        request.set_action_name('SendSms')
        request.set_version('2017-05-25')

        request.add_query_param('SignName', ALIYUN_SMS_CONFIG['signName'])
        request.add_query_param('TemplateCode', ALIYUN_SMS_CONFIG['templateCode'])
        request.add_query_param('RegionId', ALIYUN_SMS_CONFIG.get('regionId'))
        request.add_query_param('PhoneNumbers', phone)
        request.add_query_param('TemplateParam', json.dumps({'code': code}))
        self._client.do_action_with_exception(request)
        logger.debug('has send to: %s code: %s', phone, code)
