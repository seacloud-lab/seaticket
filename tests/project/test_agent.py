from unittest.mock import Mock

import pytest

from seahub.project.agent.utils import (
    _build_items_map_from_actions,
    _calculate_log_status,
    _calculate_suggestions_status,
    _query_run_status_counts,
    _reformat_actions,
    cancel_agent_log_pending_actions,
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
            'target_item_type': 'github_issue',
            'target_item_id': '1_9',
            'target_item_title': 'Issue 9',
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
    'summary_row, expected',
    [
        ({'num_of_runs': 0, 'incomplete_runs': 0, 'open_suggestion_runs': 0, 'resolved_runs': 0}, ''),
        ({'num_of_runs': 1, 'incomplete_runs': 1, 'open_suggestion_runs': 1, 'resolved_runs': 0}, ''),
        ({'num_of_runs': 1, 'incomplete_runs': 0, 'open_suggestion_runs': 1, 'resolved_runs': 0}, ''),
        ({'num_of_runs': 1, 'incomplete_runs': 1, 'open_suggestion_runs': 0, 'resolved_runs': 1}, ''),
        ({'num_of_runs': 1, 'incomplete_runs': 0, 'open_suggestion_runs': 0, 'resolved_runs': 0}, 'done'),
        ({'num_of_runs': 1, 'incomplete_runs': 0, 'open_suggestion_runs': 0, 'resolved_runs': 1}, 'done'),
        ({'num_of_runs': 2, 'incomplete_runs': 0, 'open_suggestion_runs': 0, 'resolved_runs': 1}, 'done'),
    ],
)
def test_calculate_log_status(summary_row, expected):
    assert _calculate_log_status(summary_row) == expected


def test_list_agent_logs_counts_run_statuses_per_owner():
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
                    'owner_source_id': '1_9',
                    'owner_source_type': 'github_issue',
                    'status': 'completed',
                    'suggestions_status': 'none',
                    'bucket_size': 1,
                },
                {
                    'owner_source_id': '42',
                    'owner_source_type': 'ticket',
                    'status': 'completed',
                    'suggestions_status': 'resolved',
                    'bucket_size': 1,
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
    assert statuses[('github_issue', '1_9')] == 'done'
    assert statuses[('ticket', '42')] == 'done'

    assert seadb_api.query_rows.call_count == 2
    summary_sql = seadb_api.query_rows.call_args_list[0].args[1]
    assert 'GROUP BY `owner_source_id`, `owner_source_type` ' in summary_sql
    count_sql = seadb_api.query_rows.call_args_list[1].args[1]
    assert 'COUNT(*)' in count_sql
    assert 'GROUP BY `owner_source_id`, `owner_source_type`, `status`, `suggestions_status`' in count_sql
    assert seadb_api.query_rows.call_args_list[1].kwargs['params'] == [
        '1_9', 'github_issue', '42', 'ticket',
    ]


def test_query_run_status_counts_buckets_incomplete_runs_first():
    seadb_api = Mock()
    seadb_api.query_rows.return_value = {
        'results': [
            # An unfinished run with pending suggestions only counts as incomplete.
            {
                'owner_source_id': '42',
                'owner_source_type': 'ticket',
                'status': 'running',
                'suggestions_status': 'pending',
                'bucket_size': 2,
            },
            {
                'owner_source_id': '42',
                'owner_source_type': 'ticket',
                'status': 'completed',
                'suggestions_status': 'resolved',
                'bucket_size': 3,
            },
        ]
    }

    counts = _query_run_status_counts(seadb_api, 'project-1', [
        {'owner_source_id': '42', 'owner_source_type': 'ticket'},
    ])

    assert counts[('42', 'ticket')] == {
        'incomplete_runs': 2,
        'open_suggestion_runs': 0,
        'resolved_runs': 3,
    }


def test_get_agent_log_runs_includes_all_suggestions_for_non_ticket():
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
                    'references': '[]',
                    'target_item_type': '',
                    'target_item_id': '',
                    'target_item_title': '',
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
                    'references': '[]',
                    'target_item_type': 'github_issue',
                    'target_item_id': '1_9',
                    'target_item_title': 'Issue 9',
                    'created_at': '2026-08-20T00:00:02+00:00',
                    'executed_at': '',
                },
                {
                    '_pk': 3,
                    'run_id': 7,
                    'action_type': 'suggestion',
                    'tool_name': 'suggest_notify_assignee',
                    'result': 'notify',
                    'status': 'pending',
                    'suggestion_reason': '',
                    'suggestion_content': '',
                    'references': '[]',
                    'target_item_type': 'ticket',
                    'target_item_id': '42',
                    'target_item_title': 'Ticket 42',
                    'created_at': '2026-08-20T00:00:03+00:00',
                    'executed_at': '',
                },
            ]
        },
    ]

    result = get_agent_log_runs(seadb_api, 'project-1', '1_9', 'github_issue')
    assert [run['id'] for run in result['runs']] == [7]
    # All actions are returned, including the suggestion targeting another source.
    assert len(result['runs'][0]['actions']) == 3

    actions_sql = seadb_api.query_rows.call_args_list[1].args[1]
    assert 'target_item_id` = ?' not in actions_sql
    assert seadb_api.query_rows.call_args_list[1].kwargs == {}


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
                    'references': '[]',
                    'target_item_type': '',
                    'target_item_id': '',
                    'target_item_title': '',
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
                    'references': '[]',
                    'target_item_type': 'github_issue',
                    'target_item_id': '1_9',
                    'target_item_title': 'Issue 9',
                    'created_at': '2026-08-20T00:00:01+00:00',
                    'executed_at': '',
                },
            ]
        },
    ]

    result = get_agent_log_runs(seadb_api, 'project-1', '42', 'ticket')
    assert [run['id'] for run in result['runs']] == [10]
    assert len(result['runs'][0]['actions']) == 2
    assert seadb_api.query_rows.call_args_list[1].kwargs == {}


def test_get_agent_log_runs_raises_when_owner_not_found():
    seadb_api = Mock()
    seadb_api.query_rows.return_value = {'results': []}
    with pytest.raises(ValueError, match='Item not found.'):
        get_agent_log_runs(seadb_api, 'project-1', '1_9', 'github_issue')


def test_cancel_agent_log_pending_actions_cancels_only_pending_actions():
    seadb_api = Mock()
    seadb_api.query_rows.side_effect = [
        {'results': [{
            '_pk': 7,
            'owner_source_id': '42',
            'owner_source_type': 'ticket',
        }]},
        {'results': [
            {'_pk': 1, 'run_id': 7},
            {'_pk': 2, 'run_id': 7},
        ]},
        {'results': [
            {'status': 'cancelled'},
        ]},
        {'results': [{
            '_pk': 7,
            'status': 'completed',
            'suggestions_status': 'resolved',
            'owner_source_id': '42',
            'owner_source_type': 'ticket',
            'owner_source_title': 'Ticket 42',
            'started_at': None,
            'finished_at': None,
            'error_message': '',
            'event': '{}',
        }]},
        {'results': []},
    ]

    result = cancel_agent_log_pending_actions(
        seadb_api,
        'project-1',
        '42',
        'ticket',
        'Cancelled by Alice',
        '2026-09-01T00:00:00+00:00',
    )

    assert result == {'runs': [{
        'id': 7,
        'status': 'completed',
        'suggestions_status': 'resolved',
        'owner_source_type': 'ticket',
        'owner_source_id': '42',
        'owner_source_title': 'Ticket 42',
        'started_at': None,
        'finished_at': None,
        'error_message': '',
        'event': {},
        'actions': [],
    }]}
    pending_actions_sql = seadb_api.query_rows.call_args_list[1].args[1]
    assert "`status` = 'pending'" in pending_actions_sql
    assert '`run_id` IN (7)' in pending_actions_sql
    assert seadb_api.update_rows.call_args_list[0].args[2] == [
        {
            'pk': 1,
            'row': {
                'status': 'cancelled',
                'result': 'Cancelled by Alice',
                'executed_at': '2026-09-01T00:00:00+00:00',
            },
        },
        {
            'pk': 2,
            'row': {
                'status': 'cancelled',
                'result': 'Cancelled by Alice',
                'executed_at': '2026-09-01T00:00:00+00:00',
            },
        },
    ]
    assert seadb_api.update_rows.call_count == 2
