import logging

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects
from seahub.organizations.models import Organization
from seahub.api2.endpoints.admin.projects import get_project_info


logger = logging.getLogger(__name__)


class OrgProjects(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request, org_id):
        # arguments check
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 20))
        except:
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        start, end = (page - 1) * per_page, page * per_page
        projects = Projects.objects.filter(workspace__org_id=org_id, deleted=False).select_related('workspace')
        project_list = [get_project_info(d) for d in projects[start: end]]

        return Response({'projects': project_list, 'count': projects.count()})
