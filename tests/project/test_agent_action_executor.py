from unittest.mock import Mock

from seahub.project.agent_action_executor import AgentActionExecutor


def test_extract_suggested_labels_uses_structured_payload():
    labels = AgentActionExecutor()._extract_suggested_labels(
        {'suggested_labels': ['Bug', 'needs-info', 'bug', '  ']}, ''
    )

    assert labels == ['Bug', 'needs-info']


def test_extract_suggested_labels_rejects_non_list_payload():
    executor = AgentActionExecutor()

    assert executor._extract_suggested_labels({'suggested_labels': {'label': 'Bug'}}, '') == []


def test_extract_suggested_labels_rejects_invalid_payload():
    executor = AgentActionExecutor()

    assert executor._extract_suggested_labels({'suggested_labels': 123}, '') == []


def test_extract_suggested_labels_falls_back_to_display_text():
    labels = AgentActionExecutor()._extract_suggested_labels(
        {}, 'Assign labels ["Bug"] to this GitHub issue'
    )

    assert labels == ['Bug']


def test_parse_suggested_labels_supports_legacy_display_text():
    labels = AgentActionExecutor._parse_suggested_labels(
        'Suggest assigning labels ["Bug"] to this GitHub issue'
    )

    assert labels == ['Bug']


def test_github_label_action_passes_structured_payload_to_executor():
    executor = AgentActionExecutor()
    seadb_api = Mock()
    executor._execute_github_suggest_assign_labels = Mock(return_value={'status': 'success'})

    result = executor._execute_github_issue_action(
        seadb_api=seadb_api,
        project=Mock(),
        project_uuid='project-uuid',
        source_id='1_2',
        tool_name='suggest_assign_labels',
        suggestion_text='Display text can change',
        suggestion_payload={'suggested_labels': ['Bug']},
        suggestion_content='',
        operator='user@example.com',
    )

    assert result == {'status': 'success'}
    executor._execute_github_suggest_assign_labels.assert_called_once_with(
        seadb_api, 'project-uuid', '1_2', 'Display text can change', {'suggested_labels': ['Bug']}
    )
