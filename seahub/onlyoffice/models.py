# -*- coding: utf-8 -*-
import datetime

from django.db import models


class OnlyOfficeDocKey(models.Model):
    """Model used for storing OnlyOffice doc key.
    """
    doc_key = models.CharField(max_length=36, db_index=True)
    username = models.CharField(max_length=255)
    repo_id = models.CharField(max_length=36)
    file_path = models.TextField()
    repo_id_file_path_md5 = models.CharField(max_length=100, db_index=True, unique=True)
    created_time = models.DateTimeField(default=datetime.datetime.now)

    class Meta:
        db_table = 'onlyoffice_doc_key'
