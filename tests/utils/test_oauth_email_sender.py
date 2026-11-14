import base64
from email import message_from_bytes
from email.utils import parseaddr
from unittest.mock import Mock, patch

import pytest

from seahub.utils.email_sender import GmailSender, MicrosoftSender, EmailConfigError
from seahub.utils.email_oauth import OAuthTokenClient, EmailAuthProviderError


@pytest.mark.parametrize('sender_class,account_type,principal', [
    (GmailSender, 'personal', 'users/me'),
    (MicrosoftSender, 'personal', 'me'),
    (MicrosoftSender, 'shared', 'users/shared%40example.com'),
])
def test_oauth_sender_uses_mailbox_principal_and_configured_from(sender_class, account_type, principal):
    sender = sender_class(
        {'account_type': account_type, 'sender_email': 'shared@example.com', 'sender_name': 'Support'},
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
        assert parseaddr(msg['From']) == ('Support', 'shared@example.com')
    else:
        assert 'From: Support <shared@example.com>' in post.call_args.kwargs['data']
    assert result['success'] is True


def test_gmail_rejects_shared():
    with pytest.raises(EmailConfigError, match='account type'):
        GmailSender({'account_type': 'shared'})


def test_token_refresh_failure_does_not_log_sensitive_details(caplog):
    sensitive_value = 'sensitive-oauth-configuration'
    client = OAuthTokenClient(
        {}, {'refresh_token': sensitive_value, 'expires_at': 0},
        {'client_id': sensitive_value, 'client_secret': sensitive_value,
         'token_url': 'https://sensitive.example/token', 'scopes': ['scope']},
    )
    response = Mock(status_code=400)
    response.json.return_value = {'error_description': sensitive_value}
    with patch('seahub.utils.email_oauth.requests.post', return_value=response):
        with pytest.raises(EmailAuthProviderError):
            client._request_access_token()
    assert 'Failure to fetch new access token' in caplog.text
    assert sensitive_value not in caplog.text
    assert client.token_url not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)
