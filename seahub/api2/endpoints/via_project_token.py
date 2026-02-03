from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import ProjectAPITokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Workspaces, Projects
from seahub.project.utils import check_project_permission
from seahub.utils import uuid_str_to_32_chars
from seahub.utils.indexer import search


class ViaProjectSearchView(APIView):
    authentication_classes = (ProjectAPITokenAuthentication, )
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        project_api_token_obj = getattr(request, 'project_api_token_obj')
        project_uuid = str(project_api_token_obj.project_id)
        if not project_uuid:
            error_msg = 'project_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        query = request.data.get('query')
        if not query:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        search_type = request.data.get('search_type', 'normal_search')
        try:
            count = int(request.GET.get('count', '20'))
        except ValueError:
            count = 20

        extra_sources = request.data.get('extra_sources', [])
        if extra_sources and not isinstance(extra_sources, list):
            error_msg = 'extra_sources invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        connection_ids = request.data.get('connection_ids')
        if not connection_ids and not extra_sources:
            error_msg = 'sources invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        time_from = request.data.get('time_from')
        time_to = request.data.get('time_to')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace_id = project.workspace_id
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = f'Workspace {workspace_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = project_api_token_obj.generated_by
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        permission = project_api_token_obj.permission
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'query': query,
            'connection_ids': connection_ids,
            'username': username,
            'extra_sources': extra_sources,
            'count': count,
            'time_from': time_from,
            'time_to': time_to,
            'search_type': search_type,
        }
        results = search(params)
        if results is None:
            results = []

        return Response({'results': results})
