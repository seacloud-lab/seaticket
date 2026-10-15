from unittest.mock import Mock, patch

import pytest
from django.core import mail
from django.test import override_settings

from seahub.utils.mail import send_html_email_with_dj_template


@pytest.mark.parametrize('sender_name', ['Acme Support', 'Support portal'])
@override_settings(
    DEFAULT_FROM_EMAIL='SeaTicket <noreply@example.com>',
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
def test_html_template_email_uses_optional_sender_name_and_keeps_address(sender_name):
    template = Mock()
    template.render.return_value = '<p>message</p>'
    with patch('seahub.utils.mail.loader.get_template', return_value=template), \
            patch('seahub.utils.mail.get_site_scheme_and_netloc', return_value='https://example.com'), \
            patch('seahub.utils.mail.get_site_name', return_value='SeaTicket'), \
            patch('seahub.utils.mail.os.path.exists', return_value=False):
        sent = send_html_email_with_dj_template(
            'recipient@example.com', 'Subject', 'template.html', sender_name=sender_name
        )

    assert sent is True
    assert mail.outbox[-1].message()['From'] == f'{sender_name} <noreply@example.com>'


@override_settings(
    DEFAULT_FROM_EMAIL='SeaTicket <noreply@example.com>',
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
def test_html_template_email_keeps_default_sender_when_name_is_not_supplied():
    template = Mock()
    template.render.return_value = '<p>message</p>'
    with patch('seahub.utils.mail.loader.get_template', return_value=template), \
            patch('seahub.utils.mail.get_site_scheme_and_netloc', return_value='https://example.com'), \
            patch('seahub.utils.mail.get_site_name', return_value='SeaTicket'), \
            patch('seahub.utils.mail.os.path.exists', return_value=False):
        sent = send_html_email_with_dj_template('recipient@example.com', 'Subject', 'template.html')

    assert sent is True
    assert mail.outbox[-1].message()['From'] == 'SeaTicket <noreply@example.com>'
