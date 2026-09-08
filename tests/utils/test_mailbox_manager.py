from unittest.mock import Mock, patch

import pytest

from seahub.utils.mailbox_manager import (
    GmailMailboxManager,
    MailboxConfigError,
    MicrosoftMailboxManager,
)


def make_oauth_config():
    return {
        'client_id': 'client-id',
        'client_secret': 'client-secret',
        'token_url': 'https://provider.example/token',
        'scopes': ['scope'],
    }


def make_oauth_token():
    return {
        'access_token': 'access-token',
        'refresh_token': 'refresh-token',
        'expires_at': 9999999999,
    }


def response(payload):
    result = Mock(status_code=200)
    result.json.return_value = payload
    return result


class TestGmailMailboxManager:
    @patch('seahub.utils.mailbox_manager.requests.post')
    @patch('seahub.utils.mailbox_manager.requests.get')
    def test_moves_message_to_trash(self, get_mock, post_mock):
        get_mock.return_value = response({'messages': [{'id': 'gmail-id'}]})
        post_mock.return_value = response({})
        manager = GmailMailboxManager({}, make_oauth_token(), make_oauth_config())

        result = manager.move_to_trash(['<message@example.com>'])

        assert result['moved_count'] == 1
        post_mock.assert_called_once_with(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/gmail-id/trash',
            headers={'Authorization': 'Bearer access-token'},
        )

    @patch('seahub.utils.mailbox_manager.requests.post')
    @patch('seahub.utils.mailbox_manager.requests.get')
    def test_moves_message_to_junk_by_modifying_labels(self, get_mock, post_mock):
        get_mock.return_value = response({'messages': [{'id': 'gmail-id'}]})
        post_mock.return_value = response({})
        manager = GmailMailboxManager({}, make_oauth_token(), make_oauth_config())

        result = manager.move_to_junk(['<message@example.com>'])

        assert result['moved_count'] == 1
        post_mock.assert_called_once_with(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/gmail-id/modify',
            json={'addLabelIds': ['SPAM'], 'removeLabelIds': ['INBOX']},
            headers={'Authorization': 'Bearer access-token', 'Content-Type': 'application/json'},
        )


class TestMicrosoftMailboxManager:
    @pytest.mark.parametrize(
        ('config', 'endpoint', 'method_name', 'destination_id'),
        [
            ({'account_type': 'personal'}, 'https://graph.microsoft.com/v1.0/me/messages',
              'move_to_trash', 'deleteditems'),
            ({'account_type': 'shared', 'sender_email': 'shared+mail@example.com'},
              'https://graph.microsoft.com/v1.0/users/shared%2Bmail%40example.com/messages',
              'move_to_trash', 'deleteditems'),
            ({'account_type': 'shared', 'sender_email': 'shared+mail@example.com'},
              'https://graph.microsoft.com/v1.0/users/shared%2Bmail%40example.com/messages',
              'move_to_junk', 'junkemail'),
        ],
    )
    @patch('seahub.utils.mailbox_manager.requests.post')
    @patch('seahub.utils.mailbox_manager.requests.get')
    def test_moves_message_in_configured_mailbox(
            self, get_mock, post_mock, config, endpoint, method_name, destination_id):
        get_mock.return_value = response({'value': [{'id': 'ms-id'}]})
        post_mock.return_value = response({})
        manager = MicrosoftMailboxManager(config, make_oauth_token(), make_oauth_config())

        result = getattr(manager, method_name)(['<message@example.com>'])

        assert result['moved_count'] == 1
        assert get_mock.call_args.args[0] == endpoint
        post_mock.assert_called_once_with(
            f'{endpoint}/ms-id/move',
            json={'destinationId': destination_id},
            headers={'Authorization': 'Bearer access-token', 'Content-Type': 'application/json'},
        )

    def test_shared_mailbox_requires_sender_email(self):
        with pytest.raises(MailboxConfigError, match='Shared email sender address is required'):
            MicrosoftMailboxManager({'account_type': 'shared'}, make_oauth_token(), make_oauth_config())
