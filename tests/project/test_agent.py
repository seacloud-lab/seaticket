from unittest.mock import Mock

import pytest

from seahub.project.agent import (
    _build_items_map_from_actions,
    _calculate_log_status,
    _calculate_suggestions_status,
    _reformat_actions,
    get_agent_log_runs,
    list_agent_logs,
)


def test_reformat_actions_ignores_actions_without_a_phase():
    assert _reformat_actions([
        {'action_type': 'tool_call', 'tool_name': 'get_record', 'phase': None},
    ]) == {}


def test_reformat_actions_keeps_an_empty_tool_name():
    action = {'action_type': 'tool_call', 'tool_name': '', 'phase': 'prelude'}
    assert _reformat_actions([action]) == {'prelude': {'actions': [action]}}


def test_build_items_map_groups_owner_and_target_fields():
    actions = [
        {
            '_pk': 1,
            'action_type': 'analysis',
            'tool_name': None,
            'phase': 'analysis',
            'result': 'owner result',
            'status': 'completed',
        },
        {
            '_pk': 2,
            'action_type': 'suggestion',
            'tool_name': 'suggest_reply',
            'phase': 'analysis',
            'result': 'suggestion result',
            'status': 'pending',
            'target_source_type': 'github_issue',
            'target_source_id': '1_9',
            'target_source_title': 'Issue 9',
        },
    ]

    items_map = _build_items_map_from_actions(actions, owner_source={
        'source_type': 'ticket',
        'source_id': '42',
        'source_title': 'Ticket 42',
    })

    assert ('ticket', '42') in items_map
    assert ('github_issue', '1_9') in items_map
    assert items_map[('ticket', '42')]['source_title'] == 'Ticket 42'
    assert items_map[('github_issue', '1_9')]['source_title'] == 'Issue 9'


@pytest.mark.parametrize(
    'statuses, expected',
    [
        ([], 'none'),
        (['pending'], 'pending'),
        (['executing', 'executed'], 'pending'),
        (['failed'], 'failed'),
        (['executed', 'cancelled'], 'resolved'),
    ],
)
def test_calculate_suggestions_status(statuses, expected):
    assert _calculate_suggestions_status(statuses) == expected


@pytest.mark.parametrize(
    'runs, expected',
    [
        ([], ''),
        ([{'status': 'running', 'suggestions_status': 'pending'}], ''),
        ([{'status': 'completed', 'suggestions_status': ''}], ''),
        ([{'status': 'completed', 'suggestions_status': 'pending'}], ''),
        ([{'status': 'completed', 'suggestions_status': 'failed'}], ''),
        ([{'status': 'completed', 'suggestions_status': 'none'}], 'no_action_needed'),
        ([{'status': 'completed', 'suggestions_status': 'resolved'}], 'done'),
        (
            [
                {'status': 'completed', 'suggestions_status': 'none'},
                {'status': 'completed', 'suggestions_status': 'resolved'},
            ],
            'done',
        ),
    ],
)
def test_calculate_log_status(runs, expected):
    assert _calculate_log_status(runs) == expected


def test_list_agent_logs_aggregates_status_from_runs_table():
    seadb_api = Mock()
    seadb_api.query_rows.side_effect = [
        {
            'results': [
                {
                    'owner_source_id': '1_9',
                    'owner_source_type': 'github_issue',
                    'owner_source_title': 'Issue 9',
                    'num_of_runs': 1,
                    'last_active_at': '2026-08-20T00:00:00+00:00',
                },
                {
                    'owner_source_id': '42',
                    'owner_source_type': 'ticket',
                    'owner_source_title': 'Ticket 42',
                    'num_of_runs': 1,
                    'last_active_at': '2026-08-19T00:00:00+00:00',
                },
                {
                    'owner_source_id': 'overflow',
                    'owner_source_type': 'ticket',
                    'owner_source_title': 'Overflow',
                    'num_of_runs': 1,
                    'last_active_at': '2026-08-18T00:00:00+00:00',
                },
            ]
        },
        {
            'results': [
                {
                    '_pk': 101,
                    'status': 'completed',
                    'suggestions_status': 'none',
                    'owner_source_id': '1_9',
                    'owner_source_type': 'github_issue',
                    'owner_source_title': 'Issue 9',
                },
                {
                    '_pk': 202,
                    'status': 'completed',
                    'suggestions_status': 'resolved',
                    'owner_source_id': '42',
                    'owner_source_type': 'ticket',
                    'owner_source_title': 'Ticket 42',
                },
            ]
        },
    ]

    result = list_agent_logs(seadb_api, 'project-1', page=1, per_page=2)

    assert result['has_more'] is True
    assert len(result['logs']) == 2
    statuses = {
        (log['owner_source_type'], str(log['owner_source_id'])): log['status']
        for log in result['logs']
    }
    assert statuses[('github_issue', '1_9')] == 'no_action_needed'
    assert statuses[('ticket', '42')] == 'done'


def test_get_agent_log_runs_for_non_ticket_filters_suggestions_by_target():
    seadb_api = Mock()
    seadb_api.query_rows.side_effect = [
        {
            'results': [{
                '_pk': 7,
                'status': 'completed',
                'suggestions_status': 'resolved',
                'owner_source_type': 'github_issue',
                'owner_source_id': '1_9',
                'owner_source_title': 'Issue 9',
                'started_at': None,
                'finished_at': None,
                'error_message': '',
                'event': '{}',
            }]
        },
        {
            'results': [
                {
                    '_pk': 1,
                    'run_id': 7,
                    'action_type': 'analysis',
                    'tool_name': '',
                    'result': 'ok',
                    'status': 'completed',
                    'suggestion_reason': '',
                    'suggestion_content': '',
                    'sources': '[]',
                    'target_source_type': '',
                    'target_source_id': '',
                    'target_source_title': '',
                    'created_at': '2026-08-20T00:00:00+00:00',
                    'executed_at': '2026-08-20T00:00:01+00:00',
                },
                {
                    '_pk': 2,
                    'run_id': 7,
                    'action_type': 'suggestion',
                    'tool_name': 'suggest_reply',
                    'result': 'reply',
                    'status': 'pending',
                    'suggestion_reason': '',
                    'suggestion_content': '',
                    'sources': '[]',
                    'target_source_type': 'github_issue',
                    'target_source_id': '1_9',
                    'target_source_title': 'Issue 9',
                    'created_at': '2026-08-20T00:00:02+00:00',
                    'executed_at': '',
                },
            ]
        },
    ]

    result = get_agent_log_runs(seadb_api, 'project-1', '1_9', 'github_issue')
    assert [run['id'] for run in result['runs']] == [7]
    assert len(result['runs'][0]['actions']) == 2

    actions_sql = seadb_api.query_rows.call_args_list[1].args[1]
    assert '`target_source_id` = ? AND `target_source_type` = ?' in actions_sql
    assert seadb_api.query_rows.call_args_list[1].kwargs['params'] == ['1_9', 'github_issue']


def test_get_agent_log_runs_for_ticket_keeps_cross_source_suggestions():
    seadb_api = Mock()
    seadb_api.query_rows.side_effect = [
        {
            'results': [{
                '_pk': 10,
                'status': 'completed',
                'suggestions_status': 'pending',
                'owner_source_type': 'ticket',
                'owner_source_id': '42',
                'owner_source_title': 'Ticket 42',
                'started_at': None,
                'finished_at': None,
                'error_message': '',
                'event': '{"type": "ticket_updated"}',
            }]
        },
        {
            'results': [
                {
                    '_pk': 1,
                    'run_id': 10,
                    'action_type': 'prelude',
                    'tool_name': '',
                    'result': 'ticket prelude',
                    'status': 'completed',
                    'suggestion_reason': '',
                    'suggestion_content': '',
                    'sources': '[]',
                    'target_source_type': '',
                    'target_source_id': '',
                    'target_source_title': '',
                    'created_at': '2026-08-20T00:00:00+00:00',
                    'executed_at': '',
                },
                {
                    '_pk': 2,
                    'run_id': 10,
                    'action_type': 'suggestion',
                    'tool_name': 'suggest_reply',
                    'result': 'reply',
                    'status': 'pending',
                    'suggestion_reason': '',
                    'suggestion_content': '',
                    'sources': '[]',
                    'target_source_type': 'github_issue',
                    'target_source_id': '1_9',
                    'target_source_title': 'Issue 9',
                    'created_at': '2026-08-20T00:00:01+00:00',
                    'executed_at': '',
                },
            ]
        },
    ]

    result = get_agent_log_runs(seadb_api, 'project-1', '42', 'ticket')
    assert [run['id'] for run in result['runs']] == [10]
    assert len(result['runs'][0]['actions']) == 2
    assert seadb_api.query_rows.call_args_list[1].kwargs['params'] is None


def test_get_agent_log_runs_raises_when_owner_not_found():
    seadb_api = Mock()
    seadb_api.query_rows.return_value = {'results': []}
    with pytest.raises(ValueError, match='Item not found.'):
        get_agent_log_runs(seadb_api, 'project-1', '1_9', 'github_issue')
