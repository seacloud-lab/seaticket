import json
from unittest.mock import Mock, patch

from seahub.project.agent.action_executor import AgentActionExecutor
from seahub.seadb_models.models import SchemaTables
from seahub.tickets.ticket_utils import TicketLinkValidationError


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


def test_link_existing_ticket_success_for_github_issue():
    executor = AgentActionExecutor()
    seadb_api = Mock()
    project = Mock()

    ticket = {'title': 'Tracked issue', 'linked_connection_records': []}
    sync_plan = Mock()
    connections = [Mock()]
    with patch(
        'seahub.project.agent.action_executor.get_ticket',
        return_value=(ticket, None),
    ), patch(
        'seahub.project.agent.action_executor.check_ticket_link_changes',
        return_value=(sync_plan, connections),
    ) as mock_check, patch(
        'seahub.project.agent.action_executor.sync_links_in_connection',
    ) as mock_sync, patch(
        'seahub.project.agent.action_executor.build_ticket_related_url',
        return_value='https://example.com/tickets/88',
    ):
        result = executor._execute_link_existing_ticket(
            seadb_api=seadb_api,
            project=project,
            project_uuid='project-uuid',
            source_type='github_issue',
            source_id='1_2',
            suggestion_payload={'related_ticket': 88},
            request=Mock(),
        )

    assert result['success'] is True
    payload = json.loads(result['result'])
    assert payload['ticket']['ticket_pk'] == 88
    assert payload['ticket']['ticket_url'] == 'https://example.com/tickets/88'
    assert 'linked to ticket #88' in payload['message']

    mock_check.assert_called_once_with(seadb_api, 'project-uuid', {88: (['1_2'], [])})
    mock_sync.assert_called_once_with(seadb_api, 'project-uuid', sync_plan, connections)
    seadb_api.update_rows.assert_called_once_with(
        'project-uuid',
        SchemaTables.TICKETS.table_name(),
        [{'pk': 88, 'row': {'linked_connection_records': ['1_2']}}],
    )


def test_link_existing_ticket_fails_without_related_ticket():
    executor = AgentActionExecutor()

    result = executor._execute_link_existing_ticket(
        seadb_api=Mock(),
        project=Mock(),
        project_uuid='project-uuid',
        source_type='github_issue',
        source_id='1_2',
        suggestion_payload={},
    )

    assert result['success'] is False
    assert result['status'] == 'failed'
    assert 'related_ticket' in result['result']


def test_link_existing_ticket_fails_when_target_ticket_not_found():
    executor = AgentActionExecutor()

    with patch('seahub.project.agent.action_executor.get_ticket', return_value=(None, None)):
        result = executor._execute_link_existing_ticket(
            seadb_api=Mock(),
            project=Mock(),
            project_uuid='project-uuid',
            source_type='github_issue',
            source_id='1_2',
            suggestion_payload={'related_ticket': 88},
        )

    assert result['success'] is False
    assert result['status'] == 'failed'
    assert 'Ticket #88 not found' in result['result']


def test_link_existing_ticket_fails_when_record_already_linked():
    executor = AgentActionExecutor()

    with patch(
        'seahub.project.agent.action_executor.get_ticket',
        return_value=({'title': 'Ticket'}, None),
    ), patch(
        'seahub.project.agent.action_executor.check_ticket_link_changes',
        side_effect=TicketLinkValidationError('This record is already linked to a ticket.'),
    ):
        result = executor._execute_link_existing_ticket(
            seadb_api=Mock(),
            project=Mock(),
            project_uuid='project-uuid',
            source_type='github_issue',
            source_id='1_2',
            suggestion_payload={'related_ticket': 88},
        )

    assert result['success'] is False
    assert result['status'] == 'failed'
    assert 'already linked' in result['result']
