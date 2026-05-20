# Copyright (c) 2012-2016 Seafile Ltd.
from django.apps import AppConfig
from django.core.cache import cache

class BaseConfig(AppConfig):
    name = "seahub.base"
    verbose_name = "seahub base app"

    def ready(self):
        super(BaseConfig, self).ready()
        from seahub.seadb_models.schema_loader import preload_seadb_table_schemas
        preload_seadb_table_schemas()
