import os
import sys
from seahub.organizations.signals import org_operation_signal

try:
    conf_dir = os.environ['CONF_PATH']
    sys.path.append(conf_dir)
    from seahub_custom_functions import org_operation_callback
    org_operation_signal.connect(org_operation_callback)
except Exception:
    pass
