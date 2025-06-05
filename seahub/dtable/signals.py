import django.dispatch

share_dtable_to_user = django.dispatch.Signal()
submit_form = django.dispatch.Signal()
delete_dtable = django.dispatch.Signal()
move_dtable_to_trash = django.dispatch.Signal()
restore_dtable_from_trash = django.dispatch.Signal()
