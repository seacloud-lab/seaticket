# -*- coding: utf-8 -*-
import os
import json
import logging
import requests

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt

from seaserv import seafile_api

from seahub.onlyoffice.settings import VERIFY_ONLYOFFICE_CERTIFICATE
from seahub.onlyoffice.utils import delete_doc_key, get_file_info_by_doc_key
from seahub.utils import gen_file_upload_url


# Get an instance of a logger
logger = logging.getLogger('onlyoffice')


@csrf_exempt
def onlyoffice_editor_callback(request):
    """ Callback func of OnlyOffice.
    The document editing service informs the document storage service about status of the document editing using the
    callbackUrl from JavaScript API. The document editing service use the POST request with the information in body.
    https://api.onlyoffice.com/editors/callback
    """
    if request.method != 'POST':
        logger.error('Request method is not POST.')
        # The document storage service must return the following response.
        # Otherwise the document editor will display an error message.
        return HttpResponse('{"error": 1}')

    # Defines the status of the document. Can have the following values:
    # 0 - no document with the key identifier could be found,
    # 1 - document is being edited,
    # 2 - document is ready for saving,
    # 3 - document saving error has occurred,
    # 4 - document is closed with no changes,
    # 6 - document is being edited, but the current document state is saved,
    # 7 - error has occurred while force saving the document.

    # Status 1 is received every user connection to or disconnection from document co-editing.
    #
    # Status 2 (3) is received 10 seconds after the document is closed for editing with the identifier
    # of the user who was the last to send the changes to the document editing service.
    #
    # Status 4 is received after the document is closed for editing with no changes by the last user.
    #
    # Status 6 (7) is received when the force saving request is performed.

    post_data = json.loads(request.body)
    status = int(post_data.get('status', -1))

    # get doc key and file basic info from cache
    doc_key = post_data.get('key')
    doc_info = get_file_info_by_doc_key(doc_key)
    if not doc_info:
        logger.warning('status {}: can not get doc_info from database by doc_key {}'.format(status, doc_key))
        logger.info(post_data)
        return HttpResponse('{"error": 1}')

    if status == 1:
        actions = post_data.get('actions')
        if actions:
            if actions[0].get('type') == 1:
                logger.info('status {}, user connects: {}'.format(status, post_data))
            if actions[0].get('type') == 0:
                logger.info('status {}, user disconnects: {}'.format(status, post_data))
        else:
            logger.info('status {}: {}'.format(status, post_data))
        return HttpResponse('{"error": 0}')

    if status not in (2, 4, 6):
        logger.warning('status {}: invalid status'.format(status))
        return HttpResponse('{"error": 1}')

    repo_id = doc_info['repo_id']
    file_path = doc_info['file_path']
    file_name = os.path.basename(file_path)
    parent_dir = os.path.dirname(file_path)

    logger.info('status {}: get doc_info {} from database by doc_key {}'.format(status, doc_info, doc_key))

    # save file
    if status in (2, 6):
        # Defines the link to the edited document to be saved with the document storage service.
        # The link is present when the status value is equal to 2 or 3 only.
        url = post_data.get('url')
        onlyoffice_resp = requests.get(url, verify=VERIFY_ONLYOFFICE_CERTIFICATE)
        if not onlyoffice_resp:
            logger.error('[OnlyOffice] No response from file content url.')
            return HttpResponse('{"error": 1}')

        obj_id = json.dumps({'parent_dir': parent_dir})
        token = seafile_api.get_fileserver_access_token(repo_id, obj_id, 'upload', '', use_onetime=False)

        if not token:
            logger.error('[OnlyOffice] No fileserver access token.')
            return HttpResponse('{"error": 1}')

        # update file
        update_url = gen_file_upload_url(token, 'upload-api', replace=True)
        requests.post(
            update_url,
            data={'parent_dir': parent_dir, 'relative_path': '', 'replace': 1},
            files={'file': (file_name, onlyoffice_resp.content)}
        )

        # 2 - document is ready for saving,
        if status == 2:
            logger.info('status {}: delete doc_key {} from database'.format(status, doc_key))
            delete_doc_key(doc_key)
            seafile_api.unlock_file(repo_id, file_path)

    # 4 - document is closed with no changes,
    if status == 4:
        logger.info('status {}: delete doc_key {} from database'.format(status, doc_key))
        delete_doc_key(doc_key)
        seafile_api.unlock_file(repo_id, file_path)

    return HttpResponse('{"error": 0}')
