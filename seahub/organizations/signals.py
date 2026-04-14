# Copyright (c) 2012-2016 Seafile Ltd.
from django.dispatch import Signal
from seahub.billing.views import org_operation_callback

# A new org is created
org_created = Signal()
org_role_updated = Signal()

org_operation_signal = Signal()
org_operation_signal.connect(org_operation_callback)
