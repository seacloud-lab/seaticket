import os
import logging
import urllib.request
import urllib.error
import urllib.parse
import requests
import json

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from seahub.collabora.utils import get_file_info_by_token
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.avatar.util import get_primary_avatar
from seahub.utils import gen_file_get_url, gen_file_upload_url, get_site_scheme_and_netloc

logger = logging.getLogger(__name__)

json_content_type = 'application/json; charset=utf-8'


@csrf_exempt
def CollaboraFilesContentView(request, file_id):
    if request.method == 'POST':
        """
        Save the file (with updates) from collabora online and save it to SeaTable
        """

        token = request.GET.get('access_token', None)
        info_dict = get_file_info_by_token(token)
        if info_dict is None or token is None:
            return JsonResponse('{"error": "access_token missing or invalid"}', status=500)

        if not request.body:
            logger.error("Error to get file content from collabora")
            return HttpResponse(json.dumps({"error": "Not possible to get the file content."}),
                                status=404, content_type=json_content_type)

        file_name = os.path.basename(info_dict['file_path'])
        parent_dir = os.path.dirname(info_dict['file_path'])
        logger.error("parent_dir %s" % parent_dir)
        obj_id = json.dumps({'parent_dir': parent_dir})
        logger.error("obj_id %s" % obj_id)

        try:
            file_obj = request.read()
            upload_token = seafile_api.get_fileserver_access_token(info_dict['repo_id'], obj_id, 'upload', '', use_onetime=False)

            if not upload_token:
                logger.error('Collabora has no fileserver access token.')
                return JsonResponse('{"error": 1}', status=500)

            # update file
            update_url = gen_file_upload_url(upload_token, 'upload-api', replace=True)
            response = requests.post(
                update_url,
                data={'parent_dir': parent_dir, 'relative_path': '', 'replace': 1},
                files={'file': (file_name, file_obj)}
            )
            if response.status_code != 200:
                return JsonResponse('{"error": 1}', status=500)
        except Exception as e:
            logger.error(e)
            return JsonResponse('{"error": 1}', status=500)

        return HttpResponse(json.dumps({}), status=200, content_type=json_content_type)

    if request.method == 'GET':
        """
        Collabora downloads the requested file
        """

        token = request.GET.get('access_token', None)
        info_dict = get_file_info_by_token(token)
        if info_dict is None or token is None:
            return JsonResponse('{"error": "access_token missing or invalid"}', status=500)

        request_user = info_dict['request_user']
        repo_id = info_dict['repo_id']
        file_path = info_dict['file_path']
        obj_id = info_dict['obj_id']
        can_edit = info_dict['can_edit']
        can_download = info_dict['can_download']

        file_id = seafile_api.get_file_id_by_path(repo_id, file_path)
        dl_token = seafile_api.get_fileserver_access_token(repo_id, file_id, 'download', request_user, use_onetime=False)
        if not dl_token:
            return None
        file_name = os.path.basename(file_path.rstrip('/'))
        doc_url = gen_file_get_url(dl_token, file_name)

        try:
            file_content = urllib.request.urlopen(doc_url).read()
        except urllib.error.URLError as e:
            logger.error(e)
            return JsonResponse('{"error": "Unkown. Please check dtable_web.log."}', status=500)

        return HttpResponse(file_content, content_type="application/octet-stream")

def CollaboraFilesInfoView(request, file_id):
    if request.method == 'GET':
        """
        Collabora needs more information about the file
        """

        token = request.GET.get('access_token', None)
        info_dict = get_file_info_by_token(token)
        if info_dict is None or token is None:
            return JsonResponse('{"error": "access_token missing or invalid"}', status=500)

        request_user = info_dict['request_user']
        repo_id = info_dict['repo_id']
        file_path = info_dict['file_path']
        obj_id = info_dict['obj_id']
        can_edit = info_dict['can_edit']
        can_download = info_dict['can_download']

        # https://sdk.collaboraonline.com/docs/advanced_integration.html
        result = {}
        result['BaseFileName'] = os.path.basename(file_path)
        result['UserId'] = request_user
        result['UserFriendlyName'] = email2nickname(request_user)
        result['IsAnonymousUser'] = False
        result['HideSaveOption'] = True if not can_edit else False
        result['HideExportOption'] = True if not can_download else False
        result['EnableOwnerTermination'] = True
        result['DisablePrint'] = True if not can_download else False
        result['HidePrintOption'] = True if not can_download else False
        result['DisableCopy'] = True if not can_download else False
        result['DisableExport'] = True if not can_download else False
        result['SupportsUpdate'] = True if can_edit else False
        result['UserCanWrite'] = True if can_edit else False
        result['ReadOnly'] = True if not can_edit else False
        result['UserExtraInfo'] = {
            'mail': email2contact_email(request_user),
        }
        avatar = get_primary_avatar(request_user)
        if avatar:
            result['UserExtraInfo']['avatar'] = urllib.parse.urljoin(get_site_scheme_and_netloc(), avatar.avatar_url(80))

        # new file creation feature is not implemented on wopi host(seahub), therefore hide the "save as button"
        result['UserCanNotWriteRelative'] = True

        logger.debug('CollaboraFileInfoView result %s' % result)

        return JsonResponse(result, status=200)
