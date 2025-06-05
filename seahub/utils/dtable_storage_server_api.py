import uuid
import requests

from seahub.settings import DTABLE_STORAGE_SERVER_URL


TIMEOUT = 30


class StorageAPIError(Exception):
    pass


def uuid_str_to_36_chars(dtable_uuid):
    if len(dtable_uuid) == 32:
        return str(uuid.UUID(dtable_uuid))
    else:
        return dtable_uuid


def parse_response(response):
    if response.status_code >= 400:
        raise StorageAPIError(response.status_code, response.text)
    else:
        if response.text:
            return response.json()  # json data
        else:
            return response.text  # empty string ''


class DTableStorageServerAPI(object):
    """DTable Storage Server API
    """

    def __init__(self):
        """
        :param server_url: str
        """
        self.server_url = DTABLE_STORAGE_SERVER_URL.rstrip('/')

    def __str__(self):
        return '<DTable Storage Server API [ %s ]>' % self.server_url

    def get_dtable(self, dtable_uuid):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        url = self.server_url + '/dtables/' + dtable_uuid
        response = requests.get(url, timeout=TIMEOUT)
        try:
            data = parse_response(response)
        except StorageAPIError as e:
            if e.args[0] == 404:
                return None
        return data

    def create_empty_dtable(self, dtable_uuid):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        url = self.server_url + '/dtables/' + dtable_uuid
        response = requests.put(url, timeout=TIMEOUT)
        data = parse_response(response)
        return data

    def save_dtable(self, dtable_uuid, json_string):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        url = self.server_url + '/dtables/' + dtable_uuid
        response = requests.put(url, data=json_string, timeout=TIMEOUT)
        data = parse_response(response)
        return data

    def delete_dtable(self, dtable_uuid):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        url = self.server_url + '/dtables/' + dtable_uuid
        response = requests.delete(url, timeout=TIMEOUT)
        try:
            data = parse_response(response)
        except StorageAPIError as e:
            if e.args[0] == 404:
                return None
        return data

    def list_snapshots(self, dtable_uuid, offset, limit):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        url = self.server_url + '/snapshots/' + dtable_uuid + \
            '?offset=' + str(offset) + '&limit=' + str(limit)
        response = requests.get(url, timeout=TIMEOUT)
        data = parse_response(response)
        return data

    def get_snapshot(self, dtable_uuid, snapshot_id):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        url = self.server_url + '/snapshots/' + dtable_uuid + '/' + snapshot_id
        response = requests.get(url, timeout=TIMEOUT)
        try:
            data = parse_response(response)
        except StorageAPIError as e:
            if e.args[0] == 404:
                return None
        return data

    def create_snapshot(self, dtable_uuid):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        url = self.server_url + '/snapshots/' + dtable_uuid
        response = requests.post(url, timeout=TIMEOUT)
        data = parse_response(response)
        return data

    def migrate_snapshot(self, dtable_uuid, json_string, ctime):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        url = self.server_url + '/snapshots/' + dtable_uuid + '?ctime=' + str(ctime)
        response = requests.put(url, data=json_string, timeout=TIMEOUT)
        data = parse_response(response)
        return data

    def get_dtable_size(self, dtable_uuid):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        url = self.server_url + '/dtables/' + dtable_uuid
        response = requests.head(url, timeout=TIMEOUT)
        try:
            data = response.headers
        except StorageAPIError as e:
            return None
        return data.get('Content-Length')


storage_api = DTableStorageServerAPI()
