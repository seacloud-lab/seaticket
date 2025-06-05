import django.dispatch

new_pending_workflow_task = django.dispatch.Signal()
finish_workflow_task = django.dispatch.Signal()
dismiss_workflow_task = django.dispatch.Signal()
transferring_workflow_task = django.dispatch.Signal()
invalidate_workflow_task = django.dispatch.Signal()
