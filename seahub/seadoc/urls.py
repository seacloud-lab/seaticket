from django.urls import re_path
from .apis import SeadocAccessToken, SeadocDownloadLink, SeadocUploadFile, SeadocUploadImage, SeadocDownloadImage, \
    SeadocFileView, SeadocDirView, SeadocEditorCallBack

urlpatterns = [
    re_path(r'^access-token/(?P<file_uuid>[-0-9a-f]{36})/$', SeadocAccessToken.as_view(), name='seadoc_access_token'),
    re_path(r'^upload-file/(?P<file_uuid>[-0-9a-f]{36})/$', SeadocUploadFile.as_view(), name='seadoc_upload_file'),
    re_path(r'^download-link/(?P<file_uuid>[-0-9a-f]{36})/$', SeadocDownloadLink.as_view(), name='seadoc_download_link'),
    re_path(r'^editor-status-callback/(?P<file_uuid>[-0-9a-f]{36})/$', SeadocEditorCallBack.as_view(), name='seadoc_editor_callback'),
    re_path(r'^upload-image/(?P<file_uuid>[-0-9a-f]{36})/$', SeadocUploadImage.as_view(), name='seadoc_upload_image'),
    re_path(r'^dir/(?P<file_uuid>[-0-9a-f]{36})/$', SeadocDirView.as_view(), name='seadoc_dir_view'),
    re_path(r'^download-image/(?P<file_uuid>[-0-9a-f]{36})/(?P<filename>.*)$', SeadocDownloadImage.as_view(), name='seadoc_download_image'),
    re_path(r'^file/(?P<file_uuid>[-0-9a-f]{36})/$', SeadocFileView.as_view(), name='seadoc_file_view'),
]
