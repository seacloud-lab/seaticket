import os
import json
import logging
import stat
import posixpath
import uuid
import shutil
import requests
from urllib.parse import quote
from zipfile import ZipFile, is_zipfile

from django.http import FileResponse
from django.core.files.uploadhandler import TemporaryFileUploadHandler

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.constants import PERMISSION_READ_WRITE
from seahub.dtable.models import DTables, CustomAssetUUID
from seahub.dtable.utils import check_dtable_permission, add_dtable_io_task
from seahub.utils import get_no_duplicate_obj_name, CsrfExemptSessionAuthentication
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.seadoc.utils import gen_seadoc_base_dir, copy_sdoc_images_with_sdoc_uuid, copy_document_cover_with_sdoc_uuid, \
    get_documents_config, save_documents_config, gen_document_base_dir
from seahub.seadoc.settings import ZSDOC


from seaserv import seafile_api


logger = logging.getLogger(__name__)


def get_dirent_info(dirent):
    if stat.S_ISDIR(dirent.mode):
        is_file = False
    else:
        is_file = True

    result = {}
    result['is_file'] = is_file
    result['obj_name'] = dirent.obj_name
    result['file_size'] = dirent.size if is_file else ''
    result['last_update'] = timestamp_to_isoformat_timestr(dirent.mtime)

    return result


class DTableDocumentPluginFileView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, dtable_uuid):
        username = request.user.username

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        workspace = dtable.workspace
        # permission check
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        file_uuid = uuid.uuid4()
        base_dir = gen_seadoc_base_dir(dtable_uuid, str(file_uuid))

        try:
            base_dir_id = seafile_api.get_dir_id_by_path(repo_id, base_dir)
            if not base_dir_id:
                seafile_api.mkdir_with_parents(repo_id, '/', base_dir[1:], username)
        except Exception as e:
            logger.error('check base dir: %s error: %s', base_dir, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        parent_dir = base_dir

        new_file_name = str(file_uuid) + '.sdoc'
        try:
            seafile_api.post_empty_file(repo_id, parent_dir, new_file_name, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        new_file_path = posixpath.join(parent_dir, new_file_name)
        obj = seafile_api.get_dirent_by_path(repo_id, new_file_path)
        if not obj or stat.S_ISDIR(obj.mode):
            error_msg = 'File %s not found' % new_file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dirent_info = get_dirent_info(obj)
        relative_path = ''
        asset = CustomAssetUUID.objects.get_or_create_by_path(dtable_uuid, relative_path, new_file_name, file_uuid)
        dirent_info['uuid'] = asset.uuid

        return Response({'dirent': dirent_info})


class DTableDocumentPluginDuplicateDocumentView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, dtable_uuid):
        doc_uuid = request.data.get('doc_uuid')
        if not doc_uuid:
            error_msg = 'doc_uuid invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        workspace = dtable.workspace
        # permission check
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        documents_settings = get_documents_config(repo_id, dtable_uuid, username)

        src_doc = None
        exists_doc_names = []
        for doc in documents_settings:
            if doc.get('doc_uuid') == doc_uuid:
                src_doc = doc
            exists_doc_names.append(doc.get('doc_name', ''))

        if not src_doc:
            error_msg = 'document %s not found.' % doc_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        src_doc_uuid = src_doc.get('doc_uuid')
        src_asset = CustomAssetUUID.objects.get_by_uuid(src_doc_uuid)
        if not src_asset:
            error_msg = 'doc asset %s not found.' % src_doc_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = src_asset.dtable_uuid
        file_name = src_asset.file_name

        new_doc_uuid = uuid.uuid4()
        new_parent_dir = gen_seadoc_base_dir(dtable_uuid, str(new_doc_uuid))
        old_parent_dir = gen_seadoc_base_dir(dtable_uuid, str(src_doc_uuid))

        try:
            base_dir_id = seafile_api.get_dir_id_by_path(repo_id, new_parent_dir)
            if not base_dir_id:
                seafile_api.mkdir_with_parents(repo_id, '/', new_parent_dir[1:], username)
        except Exception as e:
            logger.error('check base dir: %s error: %s', new_parent_dir, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        new_file_name = str(new_doc_uuid) + '.sdoc'
        src_repo_id = dst_repo_id = repo_id

        # copy sdoc file
        seafile_api.copy_file(
            src_repo_id, old_parent_dir,
            json.dumps([file_name]),
            dst_repo_id, new_parent_dir,
            json.dumps([new_file_name]),
            username=username, need_progress=0, synchronous=1
        )

        relative_path = ''
        new_asset = CustomAssetUUID.objects.get_or_create_by_path(dtable_uuid, relative_path, new_file_name, new_doc_uuid)

        copy_sdoc_images_with_sdoc_uuid(src_repo_id, src_asset, dst_repo_id, new_asset, username, is_async=True)
        copy_document_cover_with_sdoc_uuid(src_repo_id, src_asset, dst_repo_id, new_asset, username, is_async=True)

        new_file_path = posixpath.join(new_parent_dir, new_file_name)
        obj = seafile_api.get_dirent_by_path(repo_id, new_file_path)
        if not obj or stat.S_ISDIR(obj.mode):
            error_msg = 'File %s not found' % new_file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_doc_name = get_no_duplicate_obj_name(src_doc.get('doc_name'), exists_doc_names)
        new_doc = {
            'doc_name': new_doc_name,
            'page_type': src_doc.get('page_type'),
            'page_orientation': src_doc.get('page_orientation'),
            'page_size': src_doc.get('page_size'),
            'page_margin': src_doc.get('page_margin'),
            'table_id': src_doc.get('table_id'),
            'view_id': src_doc.get('view_id'),
            'doc_uuid': str(new_doc_uuid),
        }

        documents_settings.append(new_doc)
        try:
            save_documents_config(repo_id, dtable_uuid, username, json.dumps(documents_settings))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'document': new_doc})


class DTableDocumentPluginDocumentsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, dtable_uuid):
        doc_name = request.data.get('doc_name')

        if not doc_name or '/' in doc_name or '\\' in doc_name:
            error_msg = 'doc_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_id = request.data.get('table_id')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        view_id = request.data.get('view_id')
        if not view_id:
            error_msg = 'view_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        page_type = request.data.get('page_type')  # A4
        if not page_type:
            error_msg = 'page_type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        page_orientation = request.data.get('page_orientation')
        if not page_orientation:
            error_msg = 'page_orientation invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            page_size = json.loads(request.data.get('page_size'))  # "page_size":'{"width":793,"height":1121}'
        except:
            page_size = {}
        if not page_size:
            error_msg = 'page_size invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            page_margin = json.loads(request.data.get('page_margin'))  # "page_margin":{"top":40,"bottom":40,"left":60,"right":60}
        except:
            page_margin = {}
        if not page_margin:
            error_msg = 'page_margin invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        print_pdf_name = request.data.get('print_pdf_name')

        username = request.user.username

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        workspace = dtable.workspace
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        repo_id = workspace.repo_id

        doc_uuid = uuid.uuid4()
        base_dir = gen_seadoc_base_dir(dtable_uuid, str(doc_uuid))

        try:
            base_dir_id = seafile_api.get_dir_id_by_path(repo_id, base_dir)
            if not base_dir_id:
                seafile_api.mkdir_with_parents(repo_id, '/', base_dir[1:], username)
        except Exception as e:
            logger.error('check base dir: %s error: %s', base_dir, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        parent_dir = base_dir

        new_file_name = str(doc_uuid) + '.sdoc'
        try:
            seafile_api.post_empty_file(repo_id, parent_dir, new_file_name, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        new_file_path = posixpath.join(parent_dir, new_file_name)
        obj = seafile_api.get_dirent_by_path(repo_id, new_file_path)
        if not obj or stat.S_ISDIR(obj.mode):
            error_msg = 'File %s not found' % new_file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        relative_path = ''
        asset = CustomAssetUUID.objects.get_or_create_by_path(dtable_uuid, relative_path, new_file_name, doc_uuid)
        documents_settings = get_documents_config(repo_id, dtable_uuid, username)

        new_doc = {
            'table_id': table_id,
            'view_id': view_id,
            'doc_uuid': str(doc_uuid),
            'doc_name': doc_name,
            'page_type': page_type,
            'page_orientation': page_orientation,
            'page_size': page_size,
            'page_margin': page_margin,
        }

        if print_pdf_name:
            new_doc['print_pdf_name'] = print_pdf_name

        documents_settings.append(new_doc)
        try:
            save_documents_config(repo_id, dtable_uuid, username, json.dumps(documents_settings))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'document': new_doc})

    def put(self, request, dtable_uuid):
        """Edit document config
        """
        documents_config = request.data.get('documents_config')
        if not documents_config:
            error_msg = 'documents_config invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        workspace = dtable.workspace
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        document_plugin_dir = gen_document_base_dir(dtable_uuid)
        try:
            dir_id = seafile_api.get_dir_id_by_path(repo_id, document_plugin_dir)
        except Exception as e:
            logger.error('get dir id error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        if not dir_id:
            return api_error(status.HTTP_404_NOT_FOUND, 'Folder %s not found' % document_plugin_dir)

        save_documents_config(repo_id, dtable_uuid, username, documents_config)

        return Response({'success': True})

    def get(self, request, dtable_uuid):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        username = request.user.username
        workspace = dtable.workspace

        if not check_dtable_permission(username, workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        documents_config = get_documents_config(repo_id, dtable_uuid, username)

        return Response({'documents': documents_config})


class DTableDocumentPluginDocumentView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, dtable_uuid, doc_uuid):
        poster_url = request.data.get('poster_url')
        page_type = request.data.get('page_type')
        page_orientation = request.data.get('page_orientation')
        doc_name = request.data.get('doc_name')
        table_id = request.data.get('table_id')
        view_id = request.data.get('view_id')
        if doc_name and ('/' in doc_name or '\\' in doc_name):
            error_msg = 'doc_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            page_size = json.loads(request.data.get('page_size'))  # "page_size":{"width":793,"height":1121}
        except:
            error_msg = 'page_size invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            page_margin = json.loads(request.data.get('page_margin'))  # "page_margin":{"top":40,"bottom":40,"left":60,"right":60}
        except:
            error_msg = 'page_margin invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        print_pdf_name = request.data.get('print_pdf_name')

        username = request.user.username

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        workspace = dtable.workspace
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        repo_id = workspace.repo_id
        documents_settings = get_documents_config(repo_id, dtable_uuid, username)

        doc_info = next(filter(lambda t: t['doc_uuid'] == doc_uuid, documents_settings), {})

        if not doc_info:
            error_msg = 'document %s not found.' % doc_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if doc_name:
            doc_info['doc_name'] = doc_name

        if poster_url:
            doc_info['poster_url'] = poster_url
        if page_type:
            doc_info['page_type'] = page_type
        if page_orientation:
            doc_info['page_orientation'] = page_orientation
        if page_size:
            doc_info['page_size'] = page_size
        if page_margin:
            doc_info['page_margin'] = page_margin
        if print_pdf_name is not None:
            doc_info['print_pdf_name'] = print_pdf_name
        if table_id:
            doc_info['table_id'] = table_id
        if view_id:
            doc_info['view_id'] = view_id

        try:
            save_documents_config(repo_id, dtable_uuid, username, json.dumps(documents_settings))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True})

    def delete(self, request, dtable_uuid, doc_uuid):
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        username = request.user.username
        workspace = dtable.workspace
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        repo_id = workspace.repo_id
        documents_settings = get_documents_config(repo_id, dtable_uuid, username)

        need_update = False
        for index, page_info in enumerate(documents_settings):
            old_doc_uuid = page_info.get('doc_uuid')
            if old_doc_uuid == doc_uuid:
                documents_settings.pop(index)
                need_update = True
                break

        if not need_update:
            return Response({'success': True})

        try:
            save_documents_config(repo_id, dtable_uuid, username, json.dumps(documents_settings))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True})


class DtableDocumentPluginDocumentExportView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, dtable_uuid):
        doc_uuid = request.GET.get('doc_uuid')
        if not doc_uuid:
            error_msg = 'doc_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        workspace = dtable.workspace
        if not check_dtable_permission(username, workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        repo_id = workspace.repo_id
        asset = CustomAssetUUID.objects.get_by_uuid(doc_uuid)
        if not asset:
            error_msg = 'seadoc uuid %s not found.' % doc_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        params = {}
        params['username'] = username
        params['repo_id'] = repo_id
        params['doc_uuid'] = doc_uuid
        params['parent_path'] = asset.parent_path
        params['dtable_uuid'] = dtable_uuid
        params['filename'] = asset.file_name

        try:
            task_id = add_dtable_io_task(type='export-document', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})


class DtableDocumentPluginExportFileView(APIView):

    def get(self, request, dtable_uuid):
        # arguments check
        doc_uuid = request.GET.get('doc_uuid')
        if not doc_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'doc_uuid invalid')
        doc_name = request.GET.get('doc_name')
        if not doc_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'doc_name invalid')
        task_id = request.GET.get('task_id')
        if not task_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'task_id invalid')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        username = request.user.username
        workspace = dtable.workspace
        if not check_dtable_permission(username, workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        tmp_base_dir = os.path.join('/tmp/document', dtable_uuid, doc_uuid)
        tmp_zip_path = os.path.join(tmp_base_dir, 'zip_file') + '.zip'  # zip path of zipped xxx.zip
        export_name = doc_name + '.' + ZSDOC

        response = FileResponse(open(tmp_zip_path, 'rb'), content_type="application/x-zip-compressed", as_attachment=True)
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(export_name)

        tmp_dir = os.path.join('/tmp/document', dtable_uuid, doc_uuid)
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)

        return response


class DtableDocumentPluginDocumentImportView(APIView):
    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, dtable_uuid):
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]
        username = request.user.username

        file = request.FILES.get('file', None)
        if not file:
            error_msg = 'file can not be found.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_id = request.data.get('table_id')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')

        view_id = request.data.get('view_id')
        if not view_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'view_id invalid')

        filename = file.name
        uploaded_temp_path = file.temporary_file_path()

        if len(filename.split('.')) != 2:
            error_msg = 'file format not supported.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_name, extension = filename.split('.')

        if not (extension.lower() == ZSDOC and is_zipfile(uploaded_temp_path)):
            error_msg = 'file format not supported.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # file max size limit is 100mb
        if file.size >> 20 > 100:
            error_msg = 'File %s is too large.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        workspace = dtable.workspace
        # permission check
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_doc_uuid = str(uuid.uuid4())

        # upload file
        tmp_extracted_path = os.path.join('/tmp/document', dtable_uuid, new_doc_uuid)
        try:
            with ZipFile(uploaded_temp_path) as zip_file:
                zip_file.extractall(tmp_extracted_path)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        document_config_file_path = os.path.join(tmp_extracted_path, 'document_config.json')
        with open(document_config_file_path, 'r') as f:
            document_config = f.read()
            doc_info = json.loads(document_config)
        doc_info['doc_uuid'] = new_doc_uuid
        doc_info['view_id'] = view_id
        doc_info['table_id'] = table_id

        relative_path = ''
        sdoc_file_name = new_doc_uuid + '.sdoc'
        asset = CustomAssetUUID.objects.get_or_create_by_path(dtable_uuid, relative_path, sdoc_file_name, new_doc_uuid)

        params = {
            'repo_id': dtable.workspace.repo_id,
            'dtable_uuid': str(dtable.uuid),
            'doc_uuid': new_doc_uuid,
            'username': username,
            'view_id': view_id,
            'table_id': table_id,
        }
        try:
            task_id = add_dtable_io_task('import-document', params)
        except Exception as e:
            logger.exception('add import-page-design task error: %s params: %s', e, params)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'document': doc_info})
