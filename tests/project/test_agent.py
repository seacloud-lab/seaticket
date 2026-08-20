from unittest.mock import Mock

import pytest

from seahub.project.agent import (
    _build_items_map_from_actions,
    _calculate_log_status,
    _extract_run_ids,
    _query_owned_run_ids,
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

    assert _reformat_actions([action]) == {
        'prelude': {'actions': [action]},
    }


def test_build_items_map_reformats_actions_by_phase():
    actions = [
        {
            '_pk': 1,
            'action_type': 'tool_call',
            'tool_name': 'get_record',
            'phase': 'prelude',
            'source_type': 'ticket',
            'source_id': '3',
            'source_title': 'Test ticket',
        },
        {
            '_pk': 2,
            'action_type': 'prelude',
            'tool_name': None,
            'phase': 'prelude',
            'prompt': 'prelude prompt',
            'input': 'prelude input',
            'result': 'prelude result',
            'source_type': 'ticket',
            'source_id': '3',
            'source_title': 'Test ticket',
        },
    ]

    items_map = _build_items_map_from_actions(actions)

    assert items_map[('ticket', '3')]['actions'] == {
        'prelude': {
            'actions': [{
                'id': 1,
                'type': 'tool_call',
                'tool_name': 'get_record',
                'phase': 'prelude',
                'prompt': '',
                'input': '',
                'result': '',
                'status': '',
                'suggestion_reason': '',
                'suggestion_text': '',
                'suggestion_content': '',
                'sources': [],
                'statistics': '',
                'created_at': '',
                'executed_at': '',
                'step': None,
                'tool_arguments': '',
                'observation': '',
            }],
            'prompt': 'prelude prompt',
            'input': 'prelude input',
            'result': 'prelude result',
        },
    }


def test_extract_run_ids_ignores_empty_and_returns_sorted_unique_ids():
    rows = [
        {'run_id': '7'},
        {'run_id': 2},
        {'run_id': None},
        {'run_id': '2'},
        {},
    ]
    assert _extract_run_ids(rows) == [2, 7]


def test_calculate_log_status_returns_empty_for_incomplete_runs_or_blocking_actions():
    assert _calculate_log_status(
        run_ids=[1, 2],
        actions=[{'action_type': 'analysis', 'status': 'completed'}],
        run_status_by_id={1: 'completed', 2: 'running'},
    ) == ''

    assert _calculate_log_status(
        run_ids=[1],
        actions=[{'action_type': 'suggestion', 'status': 'pending'}],
        run_status_by_id={1: 'completed'},
    ) == ''


def test_calculate_log_status_returns_done_or_no_action_needed():
    assert _calculate_log_status(
        run_ids=[1],
        actions=[{'action_type': 'suggestion', 'status': 'completed'}],
        run_status_by_id={1: 'completed'},
    ) == 'done'

    assert _calculate_log_status(
        run_ids=[1],
        actions=[{'action_type': 'analysis', 'status': 'completed'}],
        run_status_by_id={1: 'completed'},
    ) == 'no_action_needed'


def test_query_owned_run_ids_uses_owner_actions_only():
    seadb_api = Mock()
    seadb_api.query_rows.return_value = {
        'results': [
            {'run_id': 3},
            {'run_id': '1'},
            {'run_id': None},
        ]
    }

    run_ids = _query_owned_run_ids(seadb_api, 'project-1', '1_9', 'github_issue')

    assert run_ids == [1, 3]
    _, sql = seadb_api.query_rows.call_args.args[:2]
    assert "`action_type` != 'suggestion'" in sql
    assert seadb_api.query_rows.call_args.kwargs['params'] == ['1_9', 'github_issue']


def test_list_agent_logs_maps_join_keys_and_computes_status():
    seadb_api = Mock()
    seadb_api.query_rows.side_effect = [
        {
            'results': [
                {
                    'agent_actions.source_id': '1_9',
                    'agent_actions.source_type': 'github_issue',
                    'agent_actions.source_title': None,
                    'num_of_runs': 1,
                    'last_active_at': '2026-08-20T00:00:00+00:00',
                },
                {
                    'agent_actions.source_id': '42',
                    'agent_actions.source_type': 'ticket',
                    'agent_actions.source_title': 'Ticket 42',
                    'num_of_runs': 1,
                    'last_active_at': '2026-08-19T00:00:00+00:00',
                },
                {
                    'agent_actions.source_id': 'overflow',
                    'agent_actions.source_type': 'ticket',
                    'agent_actions.source_title': 'Overflow',
                    'num_of_runs': 1,
                    'last_active_at': '2026-08-18T00:00:00+00:00',
                },
            ]
        },
        {
            'results': [
                {'run_id': 200, 'source_id': '1_9', 'source_type': 'github_issue', 'source_title': None},
                {'run_id': 100, 'source_id': '42', 'source_type': 'ticket', 'source_title': 'Ticket 42'},
            ]
        },
        {
            'results': [
                {'run_id': 200, 'action_type': 'analysis', 'status': 'completed', 'source_id': '1_9', 'source_type': 'github_issue', 'source_title': None},
                {'run_id': 100, 'action_type': 'prelude', 'status': 'completed', 'source_id': '42', 'source_type': 'ticket', 'source_title': 'Ticket 42'},
                {'run_id': 100, 'action_type': 'suggestion', 'status': 'completed', 'source_id': '1_9', 'source_type': 'github_issue', 'source_title': None},
            ]
        },
        {
            'results': [
                {'_pk': 100, 'status': 'completed'},
                {'_pk': 200, 'status': 'completed'},
            ]
        },
    ]

    result = list_agent_logs(seadb_api, 'project-1', page=1, per_page=2)

    assert result['has_more'] is True
    assert len(result['logs']) == 2
    statuses = {
        (log['source_type'], str(log['source_id'])): log['status']
        for log in result['logs']
    }
    assert statuses[('github_issue', '1_9')] == 'no_action_needed'
    assert statuses[('ticket', '42')] == 'done'


def test_get_agent_log_runs_for_non_ticket_uses_owned_runs_only():
    seadb_api = Mock()
    seadb_api.query_rows.side_effect = [
        {'results': [{'run_id': 7}]},
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
                    'suggestion_text': '',
                    'suggestion_content': '',
                    'sources': '[]',
                    'source_type': 'github_issue',
                    'source_id': '1_9',
                    'source_title': 'Issue 9',
                    'created_at': '2026-08-20T00:00:00+00:00',
                    'executed_at': '2026-08-20T00:00:01+00:00',
                },
            ]
        },
        {'results': [{'_pk': 7, 'status': 'completed', 'started_at': None, 'finished_at': None, 'error_message': '', 'events': '[]'}]},
    ]

    result = get_agent_log_runs(seadb_api, 'project-1', '1_9', 'github_issue')

    assert [run['id'] for run in result['runs']] == [7]
    assert len(result['runs'][0]['actions']) == 1
    actions_sql = seadb_api.query_rows.call_args_list[1].args[1]
    assert "`run_id` IN (7) AND `source_id` = ? AND `source_type` = ?" in actions_sql
    assert seadb_api.query_rows.call_args_list[1].kwargs['params'] == ['1_9', 'github_issue']


def test_get_agent_log_runs_for_ticket_keeps_cross_source_suggestions():
    seadb_api = Mock()
    seadb_api.query_rows.side_effect = [
        {'results': [{'run_id': 10}]},
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
                    'suggestion_text': '',
                    'suggestion_content': '',
                    'sources': '[]',
                    'source_type': 'ticket',
                    'source_id': '42',
                    'source_title': 'Ticket 42',
                    'created_at': '2026-08-20T00:00:00+00:00',
                    'executed_at': '2026-08-20T00:00:01+00:00',
                },
                {
                    '_pk': 2,
                    'run_id': 10,
                    'action_type': 'suggestion',
                    'tool_name': 'suggest_reply',
                    'result': 'reply',
                    'status': 'completed',
                    'suggestion_reason': 'reason',
                    'suggestion_text': 'text',
                    'suggestion_content': 'content',
                    'sources': '[]',
                    'source_type': 'github_issue',
                    'source_id': '1_9',
                    'source_title': 'Issue 9',
                    'created_at': '2026-08-20T00:00:02+00:00',
                    'executed_at': '2026-08-20T00:00:03+00:00',
                },
            ]
        },
        {'results': [{'_pk': 10, 'status': 'completed', 'started_at': None, 'finished_at': None, 'error_message': '', 'events': '[{\"type\": \"ticket_updated\"}]'}]},
    ]

    result = get_agent_log_runs(seadb_api, 'project-1', '42', 'ticket')

    assert [run['id'] for run in result['runs']] == [10]
    action_source_types = {action['source_type'] for action in result['runs'][0]['actions']}
    assert action_source_types == {'ticket', 'github_issue'}
    assert seadb_api.query_rows.call_args_list[1].kwargs['params'] is None


def test_get_agent_log_runs_for_non_ticket_raises_if_no_owned_run():
    seadb_api = Mock()
    seadb_api.query_rows.return_value = {'results': []}

    with pytest.raises(ValueError, match='Item not found.'):
        get_agent_log_runs(seadb_api, 'project-1', '1_9', 'github_issue')
