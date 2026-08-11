from seahub.project.agent import _build_items_map_from_actions, _reformat_actions


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
