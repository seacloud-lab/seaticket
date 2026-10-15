import base64
from email import message_from_bytes
from email.utils import parseaddr
from unittest.mock import Mock, patch

import pytest

from seahub.utils.email_sender import GmailSender, MicrosoftSender, EmailConfigError


@pytest.mark.parametrize('sender_class,account_type,principal', [
    (GmailSender, 'personal', 'users/me'),
    (GmailSender, 'alias', 'users/me'),
    (MicrosoftSender, 'personal', 'me'),
    (MicrosoftSender, 'alias', 'me'),
    (MicrosoftSender, 'shared', 'users/alias%40example.com'),
])
def test_oauth_sender_uses_mailbox_principal_and_configured_from(sender_class, account_type, principal):
    sender = sender_class(
        {'account_type': account_type, 'sender_email': 'alias@example.com', 'sender_name': 'Support'},
        {'access_token': 'access', 'refresh_token': 'refresh', 'expires_at': 9999999999},
        {'client_id': 'id', 'client_secret': 'secret', 'token_url': 'https://provider.example/token', 'scopes': ['scope']},
    )
    response = Mock(status_code=200)
    response.json.return_value = {'id': 'sent-id'}
    with patch('seahub.utils.email_sender.requests.post', return_value=response) as post:
        result = sender.send({'message': 'hello', 'send_to': ['recipient@example.com'], 'subject': 'Test'})
    assert f'/{principal}/' in post.call_args.args[0]
    if sender_class is MicrosoftSender:
        msg = message_from_bytes(base64.b64decode(post.call_args.kwargs['data']))
        assert parseaddr(msg['From']) == ('Support', 'alias@example.com')
    else:
        assert 'From: Support <alias@example.com>' in post.call_args.kwargs['data']
    assert result['success'] is True


def test_gmail_rejects_shared():
    with pytest.raises(EmailConfigError, match='account type'):
        GmailSender({'account_type': 'shared'})
