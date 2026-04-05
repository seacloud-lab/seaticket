import logging
import time
import base64
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication
from email.utils import formataddr, parseaddr
from urllib import parse

import requests

logger = logging.getLogger(__name__)


class EmailConfigError(Exception):
    """Email configuration error"""
    pass


class EmailSendError(Exception):
    """Email send error"""
    pass


class EmailAuthProviderError(Exception):
    """Email auth provider error (OAuth token fetch failure)"""
    pass


def _check_and_raise_error(response):
    if response.status_code >= 400:
        raise ConnectionError(response.json())


class _EmailSenderBase:
    """Base class for email senders"""

    def _build_msg_obj(self, send_info):
        msg = send_info.get('message', '')
        html_msg = send_info.get('html_message', '')
        send_to = send_info.get('send_to', [])
        subject = send_info.get('subject', '')
        copy_to = send_info.get('copy_to', [])
        bcc_to = send_info.get('bcc_to', [])
        reply_to = send_info.get('reply_to', '')
        file_download_urls = send_info.get('file_download_urls', None)
        file_contents = send_info.get('file_contents', None)
        message_id = send_info.get('message_id', '')
        in_reply_to = send_info.get('in_reply_to', '')
        image_cid_url_map = send_info.get('image_cid_url_map', {})

        sender_email = self.sender_email
        if not sender_email:
            # Try to get email from username or smtp_user attribute
            try:
                sender_email = getattr(self, 'username', None) or getattr(self, 'smtp_user', None)
            except:
                pass
        if not sender_email:
            error_msg = 'Sender info is incomplete: sender\'s email is not provided!'
            logger.warning(error_msg)
            raise EmailConfigError(error_msg)

        if not msg and not html_msg:
            logger.warning('Email message invalid. message: %s, html_message: %s', msg, html_msg)
            raise EmailConfigError('Email message invalid')

        send_to = [formataddr(parseaddr(to)) for to in send_to]
        copy_to = [formataddr(parseaddr(to)) for to in copy_to]
        bcc_to = [formataddr(parseaddr(to)) for to in bcc_to]

        msg_obj = MIMEMultipart()
        msg_obj['Subject'] = subject
        msg_obj['From'] = formataddr((self.sender_name, sender_email))
        msg_obj['To'] = ",".join(send_to)
        msg_obj['Cc'] = ",".join(copy_to)
        msg_obj['Reply-to'] = reply_to

        if message_id:
            msg_obj['Message-ID'] = message_id

        if in_reply_to:
            msg_obj['In-Reply-To'] = in_reply_to

        if msg:
            plain_content_body = MIMEText(msg)
            msg_obj.attach(plain_content_body)

        if html_msg:
            html_content_body = MIMEText(html_msg, 'html')
            msg_obj.attach(html_content_body)

        if html_msg and image_cid_url_map:
            for cid, image_url in image_cid_url_map.items():
                response = requests.get(image_url)
                msg_image = MIMEImage(response.content)
                msg_image.add_header('Content-ID', '<%s>' % cid)
                msg_obj.attach(msg_image)

        if file_download_urls:
            for file_name, file_url in file_download_urls.items():
                response = requests.get(file_url)
                attach_file = MIMEApplication(response.content)
                attach_file.add_header('Content-Disposition', 'attachment', filename=('utf-8', '', file_name))
                msg_obj.attach(attach_file)

        if file_contents:
            for file_name, content in file_contents.items():
                if isinstance(content, str):
                    content = content.encode('utf-8')
                attach_file = MIMEApplication(content)
                attach_file.add_header('Content-Disposition', 'attachment', filename=('utf-8', '', file_name))
                msg_obj.attach(attach_file)

        return msg_obj


class SMTPEmailSender(_EmailSenderBase):
    def __init__(self, smtp_host, smtp_port, smtp_user, smtp_password,
                 sender_name='', sender_email=None):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.sender_name = sender_name
        self.sender_email = sender_email or smtp_user

        if not all([self.smtp_host, self.smtp_port, self.smtp_user, self.smtp_password]):
            logger.error('Email config is invalid. smtp_host: %s, smtp_port: %s, smtp_user: %s',
                        self.smtp_host, self.smtp_port, self.smtp_user)
            raise EmailConfigError('Email configuration is incomplete')

    def send(self, send_info):
        copy_to = send_info.get('copy_to', [])
        bcc_to = send_info.get('bcc_to', [])
        send_to = send_info.get('send_to', [])

        try:
            msg_obj = self._build_msg_obj(send_info)
        except EmailConfigError:
            raise
        except Exception as e:
            logger.exception('Build MIME object failure: %s', e)
            raise EmailConfigError('Failed to build email message')

        try:
            smtp_port = int(self.smtp_port)
            # Port 465 uses SSL, other ports use STARTTLS
            if smtp_port == 465:
                logger.info('Connecting to SMTP server via SSL: %s:%s', self.smtp_host, smtp_port)
                context = ssl.create_default_context()
                smtp = smtplib.SMTP_SSL(self.smtp_host, smtp_port, timeout=30, context=context)
            else:
                logger.info('Connecting to SMTP server: %s:%s', self.smtp_host, smtp_port)
                try:
                    smtp = smtplib.SMTP(self.smtp_host, smtp_port, timeout=30)
                    logger.info('Starting TLS encryption')
                    smtp.starttls()
                except (smtplib.SMTPServerDisconnected, ConnectionResetError, ssl.SSLError) as e:
                    if smtp_port == 587:
                        logger.warning('STARTTLS failed on port 587, retrying with SSL: %s', e)
                        context = ssl.create_default_context()
                        smtp = smtplib.SMTP_SSL(self.smtp_host, smtp_port, timeout=30, context=context)
                    else:
                        raise
            logger.info('Logging in with username: %s', self.smtp_user)
            smtp.login(self.smtp_user, self.smtp_password)
        except Exception as e:
            logger.exception('Email server authorization failed. host: %s, port: %s, error: %s',
                           self.smtp_host, self.smtp_port, e)
            raise EmailConfigError('Email server authorization failed')

        message_id = None
        try:
            receivers = send_to + copy_to + bcc_to
            # Convert to email addresses only for sendmail
            receiver_emails = [parseaddr(r)[1] for r in receivers]
            smtp.sendmail(self.sender_email, receiver_emails, msg_obj.as_string())
            # Get message_id from the sent message
            message_id = msg_obj.get('Message-ID', '')
        except Exception as e:
            logger.exception('Send email failure: email: %s, error: %s', self.smtp_user, e)
            raise EmailSendError('Failed to send email')
        else:
            logger.info('Email sending success!')
        finally:
            smtp.quit()

        return {'success': True, 'message_id': message_id}


class _OAuthEmailSender(_EmailSenderBase):
    """Base class for OAuth-based email senders (Gmail, Microsoft)"""

    def __init__(self, config):
        self.config = config
        self.client_id = config.get('client_id')
        self.client_secret = config.get('client_secret')
        self.refresh_token = config.get('refresh_token')
        self.access_token = config.get('access_token')
        self.sender_name = config.get('sender_name', '')
        self.sender_email = config.get('sender_email') or config.get('username')
        self.expires_at = config.get('expires_at')
        self.token_url = config.get('token_url')
        self.scopes = config.get('scopes')

        if not all([self.client_id, self.client_secret, self.refresh_token, self.token_url, self.scopes]):
            logger.error('OAuth email config is invalid. client_id: %s, token_url: %s',
                        self.client_id, self.token_url)
            raise EmailConfigError('OAuth email configuration is incomplete')

    def _request_access_token(self):
        if not self.access_token or self.expires_at is None or self.expires_at - time.time() < 300:
            params = {
                'grant_type': 'refresh_token',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'refresh_token': self.refresh_token,
                'scope': ' '.join(self.scopes)
            }
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            response = requests.post(self.token_url, headers=headers, data=parse.urlencode(params))
            try:
                _check_and_raise_error(response)
            except Exception as e:
                logger.exception('Failure to fetch new access token, error: %s', e)
                raise EmailAuthProviderError('Failed to fetch access token')
            else:
                response = response.json()
                if 'access_token' not in response:
                    logger.exception('Failure to fetch new access token. No access_token in response.')
                    raise EmailAuthProviderError('No access_token in response')

            expires_at = 0
            if response.get('ext_expires_at'):
                expires_at = response.get('ext_expires_at')
            elif response.get('expires_at'):
                expires_at = response.get('expires_at')
            elif response.get('ext_expires_in'):
                expires_at = response.get('ext_expires_in') + time.time()
            elif response.get('expires_in'):
                expires_at = response.get('expires_in') + time.time()

            self._update_access_token(response.get('access_token'), expires_at, response.get('refresh_token') or self.refresh_token)

    def _update_access_token(self, new_access_token, new_expires_at, new_refresh_token):
        self.access_token = new_access_token
        self.expires_at = new_expires_at
        self.refresh_token = new_refresh_token
        self.config['access_token'] = new_access_token
        self.config['expires_at'] = new_expires_at
        self.config['refresh_token'] = new_refresh_token

    def _do_send_email(self, msg_obj):
        """Subclasses implement this to send email via their API"""
        raise NotImplementedError

    def send(self, send_info):
        try:
            msg_obj = self._build_msg_obj(send_info)
        except EmailConfigError:
            raise
        except Exception as e:
            logger.exception('Build MIME object failure: %s', e)
            raise EmailConfigError('Failed to build email message')

        self._request_access_token()
        response = self._do_send_email(msg_obj)

        success = False
        message_id = None
        try:
            _check_and_raise_error(response)
            success = True
            message_id = msg_obj.get('Message-ID', '')
        except Exception as e:
            logger.exception('Email sending failed, error: %s', e)
            raise EmailSendError('Failed to send email')
        else:
            logger.info('Email sending success!')

        return {'success': True, 'message_id': message_id}


class GmailSender(_OAuthEmailSender):
    """Gmail API email sender"""

    EMAIL_SENDING_ENDPOINT = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart'

    def _do_send_email(self, msg_obj):
        msg_string = msg_obj.as_string()

        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'message/rfc822'
        }

        return requests.post(self.EMAIL_SENDING_ENDPOINT, data=msg_string, headers=headers)


class MicrosoftSender(_OAuthEmailSender):
    """Microsoft/Outlook API email sender"""

    EMAIL_SENDING_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/sendMail'

    def _do_send_email(self, msg_obj):
        msg_bytes = msg_obj.as_bytes()
        msg_base64 = base64.b64encode(msg_bytes).decode()

        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'text/plain'
        }

        return requests.post(self.EMAIL_SENDING_ENDPOINT, data=msg_base64, headers=headers)


def get_email_sender_from_config(config):
    server_provider = config.get('server_provider', 'general_email_provider')

    if server_provider == 'general_email_provider':
        smtp_host = config.get('smtp_host')
        smtp_port = config.get('smtp_port')
        username = config.get('username')
        password = config.get('password')

        sender_email = config.get('sender_email') or username
        sender_name = config.get('sender_name', '')

        return SMTPEmailSender(
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            smtp_user=username,
            smtp_password=password,
            sender_name=sender_name,
            sender_email=sender_email,
        )
    elif server_provider == 'Gmail':
        return GmailSender(config)
    elif server_provider in ('Microsoft', 'Outlook'):
        return MicrosoftSender(config)
    else:
        logger.error('Invalid server_provider: %s', server_provider)
        raise EmailConfigError(f'Invalid server_provider: {server_provider}')


def toggle_send_email(config, send_info):
    sender = get_email_sender_from_config(config)
    return sender.send(send_info)