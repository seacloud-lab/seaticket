# Copyright (c) 2012-2016 Seafile Ltd.
import django.dispatch

# Use org_id = -1 if it's not an org repo
repo_created = django.dispatch.Signal()
repo_deleted = django.dispatch.Signal()
repo_transfer = django.dispatch.Signal()
clean_up_repo_trash = django.dispatch.Signal()
repo_restored = django.dispatch.Signal()
upload_file_successful = django.dispatch.Signal()
comment_file_successful = django.dispatch.Signal()
group_deleted = django.dispatch.Signal()
