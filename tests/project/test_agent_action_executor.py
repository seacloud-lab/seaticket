from unittest.mock import Mock

from seahub.project.agent.action_executor import AgentActionExecutor


def test_parse_suggestion_payload_accepts_dict():
    payload = {'suggested_labels': ['Bug']}
    assert AgentActionExecutor._parse_suggestion_payload(payload) is payload


def test_parse_suggestion_payload_parses_json_object():
    assert AgentActionExecutor._parse_suggestion_payload('{"suggested_type": "Bug"}') == {
        'suggested_type': 'Bug'
    }


def test_parse_suggestion_payload_rejects_invalid_json():
    assert AgentActionExecutor._parse_suggestion_payload('Bug') == {}


def test_github_label_action_passes_suggestion_payload_to_executor():
    executor = AgentActionExecutor()
    seadb_api = Mock()
    executor._execute_github_suggest_assign_labels = Mock(return_value={'status': 'success'})

    result = executor._execute_github_issue_action(
        seadb_api=seadb_api,
        project=Mock(),
        project_uuid='project-uuid',
        source_id='1_2',
        tool_name='suggest_assign_labels',
        suggestion_content='["Bug"]',
        suggestion_payload={'suggested_labels': ['Bug']},
        operator='user@example.com',
    )

    assert result == {'status': 'success'}
    executor._execute_github_suggest_assign_labels.assert_called_once_with(
        seadb_api, 'project-uuid', '1_2', {'suggested_labels': ['Bug']}
    )


def test_execute_action_reads_target_source_fields():
    executor = AgentActionExecutor()
    executor._execute_github_issue_action = Mock(return_value={'success': True, 'result': 'ok'})
    seadb_api = Mock()
    project = Mock()

    result = executor.execute_action(
        seadb_api=seadb_api,
        project=project,
        project_uuid='project-uuid',
        action={
            '_pk': 1,
            'tool_name': 'suggest_reply',
            'target_item_type': 'github_issue',
            'target_item_id': '1_2',
            'suggestion_content': 'reply content',
        },
        operator='user@example.com',
    )

    assert result['success'] is True
    executor._execute_github_issue_action.assert_called_once_with(
        seadb_api,
        project,
        'project-uuid',
        '1_2',
        'suggest_reply',
        'reply content',
        {},
        'user@example.com',
        request=None,
        auto_executed=False,
    )


def test_execute_action_parses_suggestion_payload_json():
    executor = AgentActionExecutor()
    executor._execute_github_issue_action = Mock(return_value={'success': True, 'result': 'ok'})
    seadb_api = Mock()
    project = Mock()

    result = executor.execute_action(
        seadb_api=seadb_api,
        project=project,
        project_uuid='project-uuid',
        action={
            '_pk': 1,
            'tool_name': 'suggest_assign_labels',
            'target_item_type': 'github_issue',
            'target_item_id': '1_2',
            'suggestion_payload': '{"suggested_labels": ["Bug"]}',
        },
        operator='user@example.com',
    )

    assert result['success'] is True
    executor._execute_github_issue_action.assert_called_once_with(
        seadb_api,
        project,
        'project-uuid',
        '1_2',
        'suggest_assign_labels',
        '',
        {'suggested_labels': ['Bug']},
        'user@example.com',
        request=None,
        auto_executed=False,
    )


def test_github_modify_type_fails_without_suggested_type_payload():
    executor = AgentActionExecutor()
    executor._get_github_issue_context = Mock(return_value={'record_id': '1_2'})

    result = executor._execute_github_suggest_modify_type(
        Mock(), Mock(), 'project-uuid', '1_2', {'current_issue_type': 'Bug'}
    )

    assert result['success'] is False
    assert result['status'] == 'failed'


def test_github_assign_labels_fails_without_suggested_labels_payload():
    executor = AgentActionExecutor()
    executor._get_github_issue_context = Mock(return_value={'record_id': '1_2'})

    result = executor._execute_github_suggest_assign_labels(
        Mock(), 'project-uuid', '1_2', {'suggested_labels': 'Bug'}
    )

    assert result['success'] is False
    assert result['status'] == 'failed'
