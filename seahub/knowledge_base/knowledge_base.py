import datetime
import logging
import json

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.project.models import Projects
from seahub.knowledge_base.models import KnowledgeBaseViews
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.utils import check_project_permission
from seahub.seadb_models.models import KnowledgeBaseTable
from seahub.seadb_models.utils import list_knowledge_base_records
from seahub.knowledge_base.knowledge_base_utils import get_knowledge_base_record_by_pk

logger = logging.getLogger(__name__)


class KnowledgeBasesAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, project_uuid):
         # role permission check
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        # resources check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        # permission check
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        question = request.data.get('question')
        if not question:
            error_msg = 'question invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        raw_answer = request.data.get('answer')
        if not raw_answer:
            error_msg = 'answer invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        answer_text = None
        if isinstance(raw_answer, dict):
            answer_text = raw_answer.get('text')
        else:
            try:
                ans_obj = json.loads(raw_answer)
                answer_text = ans_obj.get('text') if isinstance(ans_obj, dict) else raw_answer
            except Exception:
                answer_text = raw_answer
        if not answer_text or not isinstance(answer_text, str) or not answer_text.strip():
            error_msg = 'answer invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        seadb_api = SeaDBAPI(request.user.username)
        try:
            row = {
                KnowledgeBaseTable.question.name: question,
                KnowledgeBaseTable.answer.name: answer_text,
                KnowledgeBaseTable.creator.name: username,
                KnowledgeBaseTable.created_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
                KnowledgeBaseTable.last_modifier.name: username,
                KnowledgeBaseTable.modified_time.name: datetime.datetime.now(datetime.UTC).isoformat(),

             }
            res = seadb_api.insert_rows(project_uuid, KnowledgeBaseTable.gen_table_name(), [row])
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
        return Response({'row': row}, status=status.HTTP_201_CREATED)

    def get(self, request, project_uuid):
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 100)
        view_id = request.GET.get('view_id')
        record_number = request.GET.get('record_number')

        try:
            start = int(start)
            limit = int(limit)
        except:
            start = 0
            limit = 100

        if record_number not in (None, ''):
            try:
                record_number = int(record_number)
            except Exception:
                return api_error(status.HTTP_400_BAD_REQUEST, 'record_number invalid')
        else:
            record_number = None

        if record_number is None and not view_id:
            error_msg = 'view_id is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            seadb_api = SeaDBAPI(username)
            if record_number is not None:
                record = get_knowledge_base_record_by_pk(seadb_api, project_uuid, record_number)
                if not record:
                    error_msg = 'Knowledge base record not found.'
                    return api_error(status.HTTP_404_NOT_FOUND, error_msg)
                return Response({'record': record})
            else:
                if start < 0:
                    error_msg = 'start invalid'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                if limit < 0:
                    error_msg = 'limit invalid'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                view = KnowledgeBaseViews.objects.get_view(project_uuid=project_uuid, view_id=view_id)
                records, columns = list_knowledge_base_records(
                    seadb_api, project_uuid, view, start, limit, username)
                return Response({
                    'records': records,
                    'columns': columns,
                })
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    def put(self, request, project_uuid):
         # role permission check
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        record_id = request.GET.get('record_id')
        try:
            record_id = int(record_id)
        except Exception:
            return api_error(status.HTTP_400_BAD_REQUEST, 'record_id invalid')
        # resources check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        # permission check
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        question = request.data.get('question')
        if not question:
            error_msg = 'question invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        raw_answer = request.data.get('answer')
        if not raw_answer:
            error_msg = 'answer invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        answer_text = None
        if isinstance(raw_answer, dict):
            answer_text = raw_answer.get('text')
        else:
            try:
                ans_obj = json.loads(raw_answer)
                answer_text = ans_obj.get('text') if isinstance(ans_obj, dict) else raw_answer
            except Exception:
                answer_text = raw_answer
        if not answer_text or not isinstance(answer_text, str) or not answer_text.strip():
            error_msg = 'answer invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        row = {
            KnowledgeBaseTable.question.name: question,
            KnowledgeBaseTable.answer.name: answer_text,
            KnowledgeBaseTable.last_modifier.name: username,
            KnowledgeBaseTable.modified_time.name: datetime.datetime.now(datetime.UTC).isoformat(),

         }
        seadb_api = SeaDBAPI(request.user.username)
        record = get_knowledge_base_record_by_pk(seadb_api, project_uuid, record_id)
        record.pop('deleted', None)
        if not record:
            error_msg = 'Knowledge base record not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        update_rows = [
            {
                'pk': record.get('_pk'),
                'row': row
            }
        ]
        try:
            res = seadb_api.update_rows(project_uuid, KnowledgeBaseTable.gen_table_name(), update_rows)
            row.update({'_pk': record.get('_pk')})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'row': row}, status=status.HTTP_200_OK)

    def delete(self, request, project_uuid):
        # role permission check
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
        
        # resources check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        # permission check
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        seadb_api = SeaDBAPI(request.user.username)
        try:
            seadb_api.delete_rows(project_uuid, KnowledgeBaseTable.gen_table_name(), record_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True}, status=status.HTTP_200_OK)
