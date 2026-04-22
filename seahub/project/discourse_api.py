import requests


class DiscourseForumAPIException(Exception):
    pass


class DiscourseForumAPI:

    def __init__(self, discourse_url, api_key, api_username, timeout=30):
        self.discourse_url = discourse_url.rstrip('/')
        self.api_key = api_key
        self.api_username = api_username
        self.timeout = timeout
        self.headers = None
        self.gen_header()

    def gen_header(self):
        self.headers = {
            "Api-Key": self.api_key,
            "Api-Username": self.api_username
        }

    def create_post(self, topic_id, raw):
        url = f'{self.discourse_url}/posts.json'
        payload = {
            'topic_id': topic_id,
            'raw': raw,
        }
        try:
            response = requests.post(
                url,
                json=payload,
                headers=self.headers,
                timeout=self.timeout,
            )
        except requests.exceptions.RequestException as e:
            raise DiscourseForumAPIException(f'Failed to create post: {e}')
        if response.status_code != 200:
            raise DiscourseForumAPIException(f'Failed to create post: {response.status_code}: {response.text}')
        return response.json()
