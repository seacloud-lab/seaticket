import json
import logging
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import jwt


logger = logging.getLogger('seaqa_io')


def check_auth_token(req):
    auth = req.headers.get('Authorization', '').split()
    if not auth or auth[0].lower() != 'token' or len(auth) != 2:
        return False, 'Token invalid.'

    token = auth[1]
    if not token:
        return False, 'Token invalid.'

    private_key = req.server.private_key
    try:
        jwt.decode(token, private_key, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidSignatureError) as e:
        return False, str(e)

    return True, None


class IoRequestHandler(BaseHTTPRequestHandler):

    def _send_json(self, status_code, data):
        body = json.dumps(data).encode('utf-8') if not isinstance(data, (bytes, bytearray)) else data
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0:
            return None
        raw = self.rfile.read(length)
        return json.loads(raw.decode('utf-8'))

    def _auth(self):
        private_key = self.server.private_key
        return check_auth_token(self)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == '/ping':
            return self._send_json(200, {'success': True})

        is_valid, error = self._auth()
        if not is_valid:
            return self._send_json(403, {'error_msg': error})

        if parsed.path == '/kb-task-status':
            qs = parse_qs(parsed.query)
            task_id = (qs.get('task_id') or [''])[0]
            io_task_manager = self.server.io_task_manager
            if not io_task_manager.is_valid_task_id(task_id):
                return self._send_json(404, {'error_msg': 'task_id not found.'})

            is_finished, task_result = io_task_manager.query_status(task_id)
            if is_finished is None:
                return self._send_json(404, {'error_msg': 'task_id not found.'})

            if task_result and not task_result.get('success'):
                return self._send_json(500, task_result)

            return_result = {'is_finished': is_finished}
            if isinstance(task_result, dict):
                return_result.update(task_result)

            return self._send_json(200, return_result)

        return self._send_json(404, {'error_msg': 'Not found'})

    def do_POST(self):
        parsed = urlparse(self.path)

        is_valid, error = self._auth()
        if not is_valid:
            return self._send_json(403, {'error_msg': error})

        io_task_manager = self.server.io_task_manager
        if io_task_manager.tasks_queue.full():
            return self._send_json(400, {'error_msg': 'tasks server busy.'})

        try:
            context = self._read_json() or {}
        except Exception:
            return self._send_json(400, {'error_msg': 'context invalid.'})

        if parsed.path == '/convert-kb-view-to-excel':
            project_uuid = context.get('project_uuid')
            view_id = context.get('view_id')
            username = context.get('username')

            if not project_uuid:
                return self._send_json(400, {'error_msg': 'project_uuid is required.'})
            if not view_id:
                return self._send_json(400, {'error_msg': 'view_id is required.'})
            if not username:
                return self._send_json(400, {'error_msg': 'username is required.'})

            try:
                task_id = io_task_manager.add_convert_kb_view_to_excel_task(project_uuid, view_id, username)
            except Exception as e:
                logger.exception(e)
                return self._send_json(500, {'error_msg': str(e)})

            return self._send_json(200, {'task_id': task_id})

        if parsed.path == '/import-kb-from-excel':
            project_uuid = context.get('project_uuid')
            username = context.get('username')
            file_name = context.get('file_name')
            preview_only = context.get('preview_only', False)

            if not project_uuid:
                return self._send_json(400, {'error_msg': 'project_uuid is required.'})
            if not username:
                return self._send_json(400, {'error_msg': 'username is required.'})
            if not file_name:
                return self._send_json(400, {'error_msg': 'file name is required.'})

            try:
                if preview_only:
                    task_id = io_task_manager.add_preview_import_kb_excel_task(project_uuid, file_name)
                else:
                    task_id = io_task_manager.add_import_kb_from_excel_task(project_uuid, username, file_name)
            except Exception as e:
                logger.exception(e)
                return self._send_json(500, {'error_msg': str(e)})

            return self._send_json(200, {'task_id': task_id})

        return self._send_json(404, {'error_msg': 'Not found'})


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
    import django

    django.setup()

    from django.conf import settings
    from seaqa_io.task_manager import IoTaskManager

    io_task_manager = IoTaskManager()
    io_task_manager.init(
        settings.SEAQA_IO_WORKERS,
        settings.SEAQA_IO_TASK_TIMEOUT,
    )
    io_task_manager.run()
    u = urlparse(settings.SEAQA_IO_INNER_SERVER_URL)
    host = u.hostname
    port = u.port

    httpd = ThreadingHTTPServer((host, int(port)), IoRequestHandler)
    httpd.io_task_manager = io_task_manager
    httpd.private_key = settings.JWT_PRIVATE_KEY

    logger.info('SeaQA-IO listening on %s', settings.SEAQA_IO_INNER_SERVER_URL)
    httpd.serve_forever()


if __name__ == '__main__':
    main()
