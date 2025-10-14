# Copyright (c) 2012-2016 Seafile Ltd.
import django.dispatch

# Use org_id = -1 if it's not an org repo
group_deleted = django.dispatch.Signal()
