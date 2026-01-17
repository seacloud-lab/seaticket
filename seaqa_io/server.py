import json
import jwt

from urllib.parse import parse_qs, urlparse
from waitress import serve

from seaqa_io import config
from seaqa_io.log import setup_logger


logger = setup_logger('seaqa_io', propagate=False)


def check_auth_token(headers, private_key):
    auth = (headers.get('Authorization') or '').split()
    if not auth or auth[0].lower() != 'token' or len(auth) != 2:
        return False, 'Token invalid.'

    token = auth[1]
    if not token:
        return False, 'Token invalid.'

    try:
        jwt.decode(token, private_key, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidSignatureError) as e:
        return False, str(e)

    return True, None


def _get_headers(environ):
    headers = {}
    for key, value in environ.items():
        if key.startswith('HTTP_'):
            header_name = key[5:].replace('_', '-').title()
            headers[header_name] = value
    if 'CONTENT_TYPE' in environ:
        headers['Content-Type'] = environ['CONTENT_TYPE']
    return headers


def _read_json(environ):
    try:
        length = int(environ.get('CONTENT_LENGTH') or 0)
    except (TypeError, ValueError):
        length = 0
    if length <= 0:
        return None
    raw = environ['wsgi.input'].read(length)
    return json.loads(raw.decode('utf-8'))


class Application:

    def __init__(self, io_task_manager, analysis_task_manager, private_key):
        self.io_task_manager = io_task_manager
        self.analysis_task_manager = analysis_task_manager
        self.private_key = private_key

    def _json_response(self, status_code, data):
        body = json.dumps(data).encode('utf-8') if not isinstance(data, (bytes, bytearray)) else data
        headers = [
            ('Content-Type', 'application/json; charset=utf-8'),
            ('Content-Length', str(len(body))),
        ]
        return status_code, headers, body

    def __call__(self, environ, start_response):
        method = environ.get('REQUEST_METHOD', 'GET').upper()
        path = environ.get('PATH_INFO', '')
        query = environ.get('QUERY_STRING', '')
        headers = _get_headers(environ)

        status_code = 404
        response = {'error_msg': 'Not found'}

        if path == '/ping':
            status_code, headers_out, body = self._json_response(200, {'success': True})
            start_response('200 OK', headers_out)
            return [body]

        is_valid, error = check_auth_token(headers, self.private_key)
        if not is_valid:
            status_code, headers_out, body = self._json_response(403, {'error_msg': error})
            start_response('403 Forbidden', headers_out)
            return [body]

        if method == 'GET':
            qs = parse_qs(query)
            if path == '/embedding-analysis-task-status':
                task_id = (qs.get('task_id') or [''])[0]
                if not self.analysis_task_manager.is_valid_task_id(task_id):
                    status_code, headers_out, body = self._json_response(404, {'error_msg': 'task_id not found.'})
                    start_response('404 Not Found', headers_out)
                    return [body]

                is_finished, task_result = self.analysis_task_manager.query_status(task_id)
                if is_finished is None:
                    status_code, headers_out, body = self._json_response(404, {'error_msg': 'task_id not found.'})
                    start_response('404 Not Found', headers_out)
                    return [body]

                if task_result and not task_result.get('success'):
                    status_code, headers_out, body = self._json_response(500, task_result)
                    start_response('500 Internal Server Error', headers_out)
                    return [body]

                return_result = {'is_finished': is_finished}
                if isinstance(task_result, dict):
                    return_result.update(task_result)

                status_code, headers_out, body = self._json_response(200, return_result)
                start_response('200 OK', headers_out)
                return [body]

            if path == '/kb-task-status':
                task_id = (qs.get('task_id') or [''])[0]
                if not self.io_task_manager.is_valid_task_id(task_id):
                    status_code, headers_out, body = self._json_response(404, {'error_msg': 'task_id not found.'})
                    start_response('404 Not Found', headers_out)
                    return [body]

                is_finished, task_result = self.io_task_manager.query_status(task_id)
                if is_finished is None:
                    status_code, headers_out, body = self._json_response(404, {'error_msg': 'task_id not found.'})
                    start_response('404 Not Found', headers_out)
                    return [body]

                if task_result and not task_result.get('success'):
                    status_code, headers_out, body = self._json_response(500, task_result)
                    start_response('500 Internal Server Error', headers_out)
                    return [body]

                return_result = {'is_finished': is_finished}
                if isinstance(task_result, dict):
                    return_result.update(task_result)

                status_code, headers_out, body = self._json_response(200, return_result)
                start_response('200 OK', headers_out)
                return [body]

        if method == 'POST':
            try:
                context = _read_json(environ) or {}
            except Exception:
                status_code, headers_out, body = self._json_response(400, {'error_msg': 'context invalid.'})
                start_response('400 Bad Request', headers_out)
                return [body]

            if path == '/add-embedding-analysis-task':
                if self.analysis_task_manager.tasks_queue.full():
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'tasks server busy.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]

                project_uuid = context.get('project_uuid')
                connection_ids = context.get('connection_ids')
                username = context.get('username')
                start_year = context.get('start_year')
                end_year = context.get('end_year')

                if not project_uuid:
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'project_uuid is required.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]
                if not connection_ids:
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'connection_ids is required.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]
                if not username:
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'username is required.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]

                if self.analysis_task_manager.has_running_task(project_uuid):
                    status_code, headers_out, body = self._json_response(
                        409,
                        {'error_msg': 'This project already has a running analysis task.'},
                    )
                    start_response('409 Conflict', headers_out)
                    return [body]

                try:
                    task_id = self.analysis_task_manager.add_embedding_analysis_task(
                        project_uuid, connection_ids, username, start_year, end_year)
                except Exception as e:
                    logger.exception(e)
                    status_code, headers_out, body = self._json_response(500, {'error_msg': str(e)})
                    start_response('500 Internal Server Error', headers_out)
                    return [body]

                status_code, headers_out, body = self._json_response(200, {'task_id': task_id})
                start_response('200 OK', headers_out)
                return [body]

            if path == '/convert-kb-view-to-excel':
                if self.io_task_manager.tasks_queue.full():
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'tasks server busy.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]

                project_uuid = context.get('project_uuid')
                view_id = context.get('view_id')
                username = context.get('username')

                if not project_uuid:
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'project_uuid is required.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]
                if not view_id:
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'view_id is required.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]
                if not username:
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'username is required.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]

                try:
                    task_id = self.io_task_manager.add_convert_kb_view_to_excel_task(project_uuid, view_id, username)
                except Exception as e:
                    logger.exception(e)
                    status_code, headers_out, body = self._json_response(500, {'error_msg': str(e)})
                    start_response('500 Internal Server Error', headers_out)
                    return [body]

                status_code, headers_out, body = self._json_response(200, {'task_id': task_id})
                start_response('200 OK', headers_out)
                return [body]

            if path == '/import-kb-from-excel':
                if self.io_task_manager.tasks_queue.full():
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'tasks server busy.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]

                project_uuid = context.get('project_uuid')
                username = context.get('username')
                file_name = context.get('file_name')
                preview_only = context.get('preview_only', False)

                if not project_uuid:
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'project_uuid is required.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]
                if not username:
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'username is required.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]
                if not file_name:
                    status_code, headers_out, body = self._json_response(400, {'error_msg': 'file name is required.'})
                    start_response('400 Bad Request', headers_out)
                    return [body]

                try:
                    if preview_only:
                        task_id = self.io_task_manager.add_preview_import_kb_excel_task(project_uuid, file_name)
                    else:
                        task_id = self.io_task_manager.add_import_kb_from_excel_task(
                            project_uuid, username, file_name)
                except Exception as e:
                    logger.exception(e)
                    status_code, headers_out, body = self._json_response(500, {'error_msg': str(e)})
                    start_response('500 Internal Server Error', headers_out)
                    return [body]

                status_code, headers_out, body = self._json_response(200, {'task_id': task_id})
                start_response('200 OK', headers_out)
                return [body]

        status_text = {
            200: 'OK',
            400: 'Bad Request',
            403: 'Forbidden',
            404: 'Not Found',
            409: 'Conflict',
            500: 'Internal Server Error',
        }.get(status_code, 'OK')
        status_code, headers_out, body = self._json_response(status_code, response)
        start_response(f'{status_code} {status_text}', headers_out)
        return [body]



def main():
    from seaqa_io.tasks.analysis_task_manager import AnalysisTaskManager
    from seaqa_io.tasks.task_manager import IoTaskManager

    io_task_manager = IoTaskManager()
    io_task_manager.init(
        config.SEAQA_IO_WORKERS,
        config.SEAQA_IO_TASK_TIMEOUT,
    )
    io_task_manager.run()

    analysis_task_manager = AnalysisTaskManager()
    analysis_task_manager.init(
        config.SEAQA_IO_WORKERS,
        config.SEAQA_IO_TASK_TIMEOUT,
    )
    analysis_task_manager.run()
    u = urlparse(config.SEAQA_IO_INNER_SERVER_URL)
    host = u.hostname
    port = u.port

    app = Application(io_task_manager, analysis_task_manager, config.JWT_PRIVATE_KEY)
    logger.info('SeaQA-IO listening on %s', config.SEAQA_IO_INNER_SERVER_URL)
    serve(app, host=host, port=int(port), threads=config.SEAQA_IO_WORKERS)


if __name__ == '__main__':
    main()
