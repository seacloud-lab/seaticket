import datetime
import logging
import json

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects
from seahub.knowledge_base.models import KnowledgeBaseViews
from seahub.project.view_utils import SQLGeneratorOptionInvalidError
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.utils import check_project_permission, get_current_table_metadata, replace_file_url_in_content
from seahub.utils.storage import upload_files_to_s3
from seahub.project.constants import KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS
from seahub.seadb_models.utils import list_knowledge_base_records
from seahub.knowledge_base.knowledge_base_utils import get_knowledge_base_record_by_pk, TABLE_KNOWLEDGE_BASE, \
    send_knowledge_base_update_msg
from seahub.utils.decorators import require_org_context

from seahub.seadb_models.models import SchemaTables


logger = logging.getLogger(__name__)


def _parse_content(raw_content):
    content_obj = json.loads(raw_content) if isinstance(raw_content, str) else raw_content
    if not isinstance(content_obj, dict):
        raise ValueError('content invalid.')
    content_text = content_obj.get('text')
    if not content_text or not isinstance(content_text, str) or not content_text.strip():
        raise ValueError('content invalid.')
    images = content_obj.get('images')
    links = content_obj.get('links')
    file_urls = []
    if images and isinstance(images, list):
        file_urls += images
    if links and isinstance(links, list):
        file_urls += links
    return content_text, file_urls


class KnowledgeBasesAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def post(self, request, project_uuid):
        title = request.data.get('title')
        if not title:
            error_msg = 'title invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        raw_content = request.data.get('content')
        if not raw_content:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            content_text, file_urls = _parse_content(raw_content)
        except ValueError:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        tag_ids = request.data.get('tags', "[]")
        tag_ids = json.loads(tag_ids)

        username = request.user.username
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        seadb_api = SeaDBAPI()
        now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
        try:
            row = {
                SchemaTables.KNOWLEDGE_BASE.title.name: title,
                SchemaTables.KNOWLEDGE_BASE.content.name: content_text,
                SchemaTables.KNOWLEDGE_BASE.tags.name: tag_ids,
                SchemaTables.KNOWLEDGE_BASE.creator.name: username,
                SchemaTables.KNOWLEDGE_BASE.created_time.name: now_datetime,
                SchemaTables.KNOWLEDGE_BASE.last_modifier.name: username,
                SchemaTables.KNOWLEDGE_BASE.modified_time.name: now_datetime,
                SchemaTables.KNOWLEDGE_BASE.deleted.name: False,
             }
            res = seadb_api.insert_rows(project_uuid, SchemaTables.KNOWLEDGE_BASE.table_name(), [row])
            pks = res.get('pks', [])
            if len(pks) != 1:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            insert_row_pk = pks[0]
            row.update({'_pk': insert_row_pk})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if file_urls:
            new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'knowledgebase', int(insert_row_pk))
            updated_content = replace_file_url_in_content(content_text, new_file_urls_dict)
            try:
                seadb_api.update_rows(project_uuid, SchemaTables.KNOWLEDGE_BASE.table_name(), [{
                    'pk': int(insert_row_pk),
                    'row': {
                        SchemaTables.KNOWLEDGE_BASE.content.name: updated_content,
                    }
                }])
                row[SchemaTables.KNOWLEDGE_BASE.content.name] = updated_content
            except Exception as e:
                logger.error(e)
                seadb_api.delete_rows(project_uuid, SchemaTables.KNOWLEDGE_BASE.table_name(), [int(insert_row_pk)])
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        send_knowledge_base_update_msg(project_uuid)
        return Response({'row': row}, status=status.HTTP_201_CREATED)

    @require_org_context
    def get(self, request, project_uuid):
        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 1000)
        view_id = request.GET.get('view_id')

        try:
            start = int(start)
            limit = int(limit)
        except:
            start = 0
            limit = 1000

        if start < 0:
            error_msg = 'start invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if limit < 0:
            error_msg = 'limit invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not view_id:
            error_msg = 'view_id is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI()
            view = KnowledgeBaseViews.objects.get_view(project_uuid=project_uuid, view_id=view_id)
            records, columns = list_knowledge_base_records(seadb_api, project_uuid, view, start, limit, username)
        except SQLGeneratorOptionInvalidError as e:
            logger.error(e)
            error_msg = _('There are errors with the filters. Please correct them.')
            return Response({'records': [], 'columns': getattr(e, 'columns', []), 'error_msg': error_msg})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'records': records,
            'columns': columns,
        })

    @require_org_context
    def delete(self, request, project_uuid):
        username = request.user.username
        record_ids = request.data.get('record_ids')
        if not record_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, 'record_ids is required')

        if not isinstance(record_ids, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'record_ids must be a list')

        try:
            record_ids = [int(rn) for rn in record_ids]
        except (ValueError, TypeError):
            return api_error(status.HTTP_400_BAD_REQUEST, 'record_ids must be a list of integers')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        seadb_api = SeaDBAPI()
        update_rows = []
        now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
        for r_id in record_ids:
            update_rows.append({
                'pk': r_id,
                'row': {
                    SchemaTables.KNOWLEDGE_BASE.deleted.name: True,
                    SchemaTables.KNOWLEDGE_BASE.last_modifier.name: username,
                    SchemaTables.KNOWLEDGE_BASE.modified_time.name: now_datetime,
                }
            })
        try:
            seadb_api.update_rows(project_uuid, SchemaTables.KNOWLEDGE_BASE.table_name(), update_rows)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        send_knowledge_base_update_msg(project_uuid)

        return Response({'success': True}, status=status.HTTP_200_OK)


class KnowledgeBaseAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid, knowledge_id):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI()
            record, columns = get_knowledge_base_record_by_pk(seadb_api, project_uuid, knowledge_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not record:
            error_msg = 'Knowledge base record not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        return Response({'record': record})

    @require_org_context
    def put(self, request, project_uuid, knowledge_id):
        row = {}
        username = request.user.username

        is_update_tags = 'tags' in request.data
        tags = request.data.get('tags')
        if is_update_tags and tags is not None:   
            if not isinstance(tags, list):
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if is_update_tags:
            row[SchemaTables.KNOWLEDGE_BASE.tags.name] = tags

        if 'title' in request.data:
            title = request.data.get('title')
            if not title:
                error_msg = 'title invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            row[SchemaTables.KNOWLEDGE_BASE.title.name] = title

        if 'content' in request.data:
            raw_content = request.data.get('content')
            if not raw_content:
                error_msg = 'content invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                content_text, file_urls = _parse_content(raw_content)
            except ValueError:
                error_msg = 'content invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if len(file_urls) > 0:
                try:
                    new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'knowledgebase', int(knowledge_id))
                    content_text = replace_file_url_in_content(content_text, new_file_urls_dict)
                except Exception as e:
                    logger.error(e)
                    error_msg = 'Upload files failed.'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            row[SchemaTables.KNOWLEDGE_BASE.content.name] = content_text

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not row:
            error_msg = 'No valid data to update.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        seadb_api = SeaDBAPI()
        record, columns = get_knowledge_base_record_by_pk(seadb_api, project_uuid, knowledge_id)
        if not record:
            error_msg = 'Knowledge base record not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        row[SchemaTables.KNOWLEDGE_BASE.last_modifier.name] = username
        row[SchemaTables.KNOWLEDGE_BASE.modified_time.name] = datetime.datetime.now(datetime.UTC).isoformat()

        update_rows = [
            {
                'pk': record.get('_pk'),
                'row': row
            }
        ]
        try:
            seadb_api.update_rows(project_uuid, SchemaTables.KNOWLEDGE_BASE.table_name(), update_rows)
            row.update({'_pk': record.get('_pk')})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        send_knowledge_base_update_msg(project_uuid)

        return Response({'row': row}, status=status.HTTP_200_OK)


class KnowledgeBasesTrashAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 1000)
        try:
            start = int(start)
            limit = int(limit)
        except:
            start = 0
            limit = 1000

        if start < 0:
            error_msg = 'start invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if limit < 0:
            error_msg = 'limit invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI()
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            kb_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_KNOWLEDGE_BASE)
            kb_columns = kb_meta.get('columns') or []
            display_columns = []
            for column in kb_columns:
                if column.get('name') in KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS:
                    display_columns.append(column)
            query_fields = ', '.join(KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS)
            sql = f"SELECT {query_fields} FROM `{TABLE_KNOWLEDGE_BASE}` WHERE `deleted` = True LIMIT {limit} OFFSET {start}"
            res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
            records = res.get('results', [])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'records': records, 'columns': display_columns})

    @require_org_context
    def put(self, request, project_uuid):
        record_ids = request.data.get('record_ids')
        if not record_ids:
            error_msg = 'record_ids is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not isinstance(record_ids, list):
            error_msg = 'record_ids must be a list'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI()
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
            update_rows = []
            for r_id in record_ids:
                update_rows.append({
                    'pk': int(r_id),
                    'row': {
                        SchemaTables.KNOWLEDGE_BASE.deleted.name: False,
                        SchemaTables.KNOWLEDGE_BASE.modified_time.name: now_datetime,
                    }
                })
            if update_rows:
                seadb_api.update_rows(project_uuid, TABLE_KNOWLEDGE_BASE, update_rows)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})
