# all about lower level code such as user group org
import os
import logging

logger = logging.getLogger(__name__)


class AppConfig(object):
    def __init__(self):
        pass

    def set(self, key, value):
        self.key = value

    def get(self, key):
        if hasattr(self, key):
            return self.__dict__[key]
        else:
            return ''

appconfig = AppConfig()


def load_env_config():
    # get central config dir
    appconfig.central_confdir = ""
    if 'SEAFILE_CENTRAL_CONF_DIR' in os.environ:
        appconfig.central_confdir = os.environ['SEAFILE_CENTRAL_CONF_DIR']

    # get ccnet config path
    appconfig.ccnet_conf_path = ""
    if appconfig.central_confdir:
        appconfig.ccnet_conf_path = os.path.join(appconfig.central_confdir, 'ccnet.conf')
    elif 'CCNET_CONF_DIR' in os.environ:
        appconfig.ccnet_conf_path = os.path.join(os.environ['CCNET_CONF_DIR'], 'ccnet.conf')


load_env_config()
