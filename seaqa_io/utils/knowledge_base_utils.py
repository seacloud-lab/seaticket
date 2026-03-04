import logging
import json

from seaqa_io.utils import mq
from seaqa_io.utils import uuid_str_to_32_chars

logger = logging.getLogger(__name__)


def send_knowledge_base_update_msg(project_uuid):
    try:
        msg_content = json.dumps({'project_uuid': uuid_str_to_32_chars(project_uuid)})
        if mq.publish('knowledge_base_update', msg_content) > 0:
            logger.debug('Publish metadata_update event: %s' % msg_content)
        else:
            logger.info('No one subscribed to metadata_update channel, event (%s) has not been send' % msg_content)
    except Exception as e:
        logger.error('send knowledge base update msg failed, error: %s', e)
