import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.project.constants import ConnectionType
from seahub.project.models import Projects, ProjectConnections
from seahub.project.utils import check_project_permission
from seahub.seadb_models.utils import list_tickets_by_search, list_documents_by_search
from seahub.project.seadb_api import SeaDBAPI

logger = logging.getLogger(__name__)
class SearchTickectsAndDocumentsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        query = request.GET.get('query', '')
        limit = 100

        if query:
            limit = 50

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check, same as AI
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # project_uuid, username, search_text, start, end
        try:
            seadb_api = SeaDBAPI(username)

            # ticket
            results = [
                {
                    '_pk': ticket.get('_pk'),
                    'title': ticket.get('title'),
                    'type': 'ticket'
                }
                for ticket in list_tickets_by_search(seadb_api, project_uuid, query, 0, limit)
            ]

            # documents, e.g., kb, site, seafile
            ## get useful connections
            documents_connections = ProjectConnections.objects.filter(project=project, type__in=[ConnectionType.SITE.value, ConnectionType.SEAFILE.value], deleted=False, is_active=True).values_list('id', 'type')
            documents_connection_id_type_map = {
                connection[0]: connection[1]
                for connection in documents_connections
            }

            ## get records
            limit -= len(results)
            if limit > 0:
                results += list_documents_by_search(seadb_api, project_uuid, documents_connection_id_type_map, query, limit)
        except Exception as e:
            logger.error(e)
            import traceback
            traceback.print_exc()
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'results': results})
