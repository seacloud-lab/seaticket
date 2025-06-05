# -*- coding: utf-8 -*-
from django.urls import re_path
from django.views.generic import RedirectView

from seahub.dtable.external_app_views import dtable_external_app_edit, dtable_external_app_view, \
    universal_app_invite_link_view, dtable_universal_app_custom_view, dtable_external_app_login_view, \
    dtable_external_app_snapshot_view, dtable_external_app_anonymous_validate_view
from .views import dtable_file_view, dtable_asset_access, dtable_asset_preview, dtable_form_view, \
    dtable_share_link_view, dtable_row_share_link_view, dtable_form_edit, dtable_snapshot_view, \
    dtable_plugin_asset_view, dtable_external_link_view, \
    dtable_external_download_link_view, dtable_export_content_view, dtable_user_view_share_file_view, \
    dtable_group_view_share_file_view, dtable_export_asset_files_view, dtable_app_export_asset_files_view, \
    dtable_embed_view, \
    dtable_export_big_data_screen_files_view, dtable_export_big_data_screen_app_files_view, \
    dtable_collection_table_view, dtable_collection_table_edit, dtable_view_external_link_view, dtable_view_embed_view, \
    dtable_page_design_view, dtable_row_page_design_view, \
    dtable_template_copy_view, custom_asset_access, custom_asset_preview, custom_asset_thumbnail, \
    dtable_form_custom_view, dtable_row_document_view, dtable_app_asset_preview

urlpatterns = [
    re_path(r'^workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/$', dtable_file_view, name='dtable_file_view'),

    re_path(r'^dtable-shared-view/personal/(?P<user_view_share_id>\d+)/$', dtable_user_view_share_file_view, name='dtable_user_view_share_file_view'),
    re_path(r'^dtable-shared-view/group/(?P<group_view_share_id>\d+)/$', dtable_group_view_share_file_view, name='dtable_group_view_share_file_view'),

    re_path(r'^dtable-plugins/(?P<plugin_name>.*)/$', dtable_plugin_asset_view, name='dtable_plugins_asset_view'),

    re_path(r'^dtable-export-content/$', dtable_export_content_view, name='dtable_export_content_view'),
    re_path(r'^dtable-export-asset-files/$', dtable_export_asset_files_view, name='dtable_export_asset_files_view'),
    re_path(r'^dtable-app-export-asset-files/$', dtable_app_export_asset_files_view, name='dtable_app_export_asset_files_view'),
    re_path(r'^dtable-export-big-data-screen/$', dtable_export_big_data_screen_files_view, name='dtable_export_big_data_screen_files_view'),
    re_path(r'^dtable-export-big-data-screen-app/$', dtable_export_big_data_screen_app_files_view, name='dtable_export_big_data_screen_app_files_view'),

    re_path(r'^workspace/(?P<workspace_id>\d+)/asset/(?P<dtable_uuid>[-0-9a-f]{36})/(?P<path>.*)$', dtable_asset_access, name='dtable_asset_access'),
    re_path(r'^workspace/(?P<workspace_id>\d+)/asset-preview/(?P<dtable_uuid>[-0-9a-f]{36})/(?P<path>.*)$', dtable_asset_preview, name='dtable_asset_preview'),
    re_path(r'^dtable/embed/(?P<token>[-0-9a-f]+)/$', dtable_embed_view, name='dtable_embed_view'),
    re_path(r'^dtable/view-embed/(?P<token>[-0-9a-f]+)/$', dtable_view_embed_view, name='dtable_view_embed_view'),
    re_path(r'^dtable/forms/(?P<token>[-0-9a-f]{36})/$', dtable_form_view, name='dtable_form_view'),
    re_path(r'^dtable/forms/custom/(?P<custom_url>[-0-9a-zA-Z]+)/$', dtable_form_custom_view, name='dtable_form_custom_view'),
    re_path(r'^dtable/form-edit/(?P<token>[-0-9a-f]{36})/$', dtable_form_edit, name='dtable_form_edit'),
    re_path(r'^dtable/collection-tables/(?P<token>[-0-9a-f]{36})/$', dtable_collection_table_view, name='dtable_collection_view'),
    re_path(r'^dtable/collection-tables-edit/(?P<token>[-0-9a-f]{36})/$', dtable_collection_table_edit, name='dtable_collection_edit'),
    re_path(r'^dtable/links/(?P<token>[-0-9a-f]+)/$', dtable_share_link_view, name='dtable_share_link_view'),
    re_path(r'^dtable/universal-app/links/(?P<token>[-0-9a-f]+)/$', universal_app_invite_link_view, name='dtable_universal_app_invite_link_view'),
    re_path(r'^dtable/row-share-links/(?P<token>[-0-9a-f]{36})/$', dtable_row_share_link_view, name='dtable_row_share_link_view'),
    re_path(r'^dtable/snapshots/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/(?P<commit_id>[-0-9a-f]{36,40})/$', dtable_snapshot_view, name='dtable_snapshot_view'),

    re_path(r'^dtable/(?P<dtable_uuid>[-0-9a-f]{36})/custom-asset/(?P<asset_uuid>[-0-9a-f]{36})/$', custom_asset_access, name='custom_asset_access'),
    re_path(r'^dtable/(?P<dtable_uuid>[-0-9a-f]{36})/custom-asset-preview/(?P<asset_uuid>[-0-9a-f]{36})/$', custom_asset_preview, name='custom_asset_preview'),
    re_path(r'^dtable/(?P<dtable_uuid>[-0-9a-f]{36})/custom-asset-thumbnail/(?P<asset_uuid>[-0-9a-f]{36})/$', custom_asset_thumbnail, name='custom_asset_thumbnail'),

    re_path(r'^external-apps/(?P<app_uuid>[-0-9a-f]{36})/$', dtable_external_app_view, name='dtable_external_app_view'),
    re_path(r'^external-apps/(?P<app_uuid>[-0-9a-f]{36})/anonymous-validate/$', dtable_external_app_anonymous_validate_view, name='dtable_external_app_anonymous_validate_view'),
    re_path(r'^external-apps/(?P<app_uuid>[-0-9a-f]{36})/snapshot/(?P<snapshot_id>\d+)/$', dtable_external_app_snapshot_view, name='dtable_external_app_snapshot_view'),
    re_path(r'^external-apps/(?P<app_uuid>[-0-9a-f]{36})/login/$', dtable_external_app_login_view, name='dtable_external_app_login_view'),
    re_path(r'^apps/custom/(?P<custom_url>[-0-9a-zA-Z]+)/$', dtable_universal_app_custom_view, name='dtable_universal_app_custom_view'),
    re_path(r'^dtable/external-apps/(?P<app_uuid>[-0-9a-f]{36})/$', RedirectView.as_view(pattern_name='dtable:dtable_external_app_view', permanent=True), name='dtable_external_app_view_redirect'),
    re_path(r'^dtable/external-apps-edit/(?P<app_uuid>[-0-9a-f]{36})/$', dtable_external_app_edit, name='dtable_external_app_edit'),
    re_path(r'^external-apps/asset-preview/(?P<app_uuid>[-0-9a-f]{36})/(?P<path>.*)$', dtable_app_asset_preview, name='dtable_app_asset_preview'),

    re_path(r'^dtable/external-links/(?P<token>[-0-9a-f]+)/$', dtable_external_link_view, name='dtable_external_link_view'),
    re_path(r'^dtable/external-links/custom/(?P<token>[-0-9a-zA-Z]+)/$', dtable_external_link_view, name='dtable_external_link_custom_view'),
    re_path(r'^dtable/external-links/(?P<token>[-0-9a-f]+)/download-zip/$', dtable_external_download_link_view, name='dtable_external_download_link_view'),
    re_path(r'^dtable/external-links/custom/(?P<token>[-0-9a-zA-Z]+)/download-zip/$', dtable_external_download_link_view, name='dtable_external_download_link_custom_view'),

    re_path(r'^dtable/view-external-links/(?P<token>[-0-9a-f]+)/$', dtable_view_external_link_view, name='dtable_view_external_link_view'),
    re_path(r'^dtable/view-external-links/custom/(?P<token>[-0-9a-zA-Z]+)/$', dtable_view_external_link_view, name='dtable_view_external_link_custom_view'),

    # re_path(r'^dtable/(?P<dtable_uuid>[-0-9a-f]{36})/page-design/(?P<page_id>)/row/(?P<row_id>.+)/$', dtable_page_design_view, name='dtable_page_design_view'),
    re_path(r'^dtable/(?P<dtable_uuid>[-0-9a-f]{36})/page-design/(?P<page_id>[-0-9a-zA-Z]{4})/$', dtable_page_design_view, name='dtable_page_design_view'),
    re_path(r'^dtable/(?P<dtable_uuid>[-0-9a-f]{36})/page-design/(?P<page_id>[-0-9a-zA-Z]{4})/row/(?P<row_id>.+)/$', dtable_row_page_design_view, name='dtable_row_page_design_view'),

    re_path(r'^dtable/(?P<dtable_uuid>[-0-9a-f]{36})/document/(?P<doc_uuid>[-0-9a-f]+)/row/(?P<row_id>.+)/$', dtable_row_document_view, name='dtable_row_document_view'),
    re_path(r'^copy-template/$', dtable_template_copy_view, name='dtable_copy_template_view'),

]
