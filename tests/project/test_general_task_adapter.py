from unittest.mock import Mock, patch

from seahub.project.task_utils import (
    create_general_task_via_adapter,
    update_general_task_via_adapter,
)


def make_response(status_code=200, data=None):
    response = Mock()
    response.status_code = status_code
    response.json.return_value = data
    response.content = b'{}'
    response.text = ''
    return response


class TestGeneralTaskAdapterConfig:
    def test_task_writes_use_complete_resource_url(self):
        create_response = make_response(data={'id': 'row-1'})
        update_response = make_response(data={'success': True})
        config = {
            'base_url': 'https://adapter.example.com/tasks/product-tasks/',
            'api_token': 'adapter-token',
        }

        with patch(
            'seahub.project.task_utils.requests.post',
            side_effect=[create_response, update_response],
        ) as post_mock:
            create_general_task_via_adapter(config, {'title': 'Task'})
            update_general_task_via_adapter(config, 'row-1', {'status': 'done'})

        assert post_mock.call_args_list[0].args[0] == 'https://adapter.example.com/tasks/product-tasks/'
        assert post_mock.call_args_list[1].args[0] == 'https://adapter.example.com/tasks/product-tasks/row-1/'
        assert 'params' not in post_mock.call_args_list[0].kwargs
        assert 'params' not in post_mock.call_args_list[1].kwargs
