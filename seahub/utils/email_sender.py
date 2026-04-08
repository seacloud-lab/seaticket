import logging
import time
import base64
import smtplib
import ssl
import imaplib
import re
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
                 sender_name='', sender_email=None,
                 imap_host=None, imap_port=None, imap_user=None, imap_password=None):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.sender_name = sender_name
        self.sender_email = sender_email or smtp_user
        # IMAP config for saving sent emails
        self.imap_host = imap_host
        self.imap_port = imap_port or 993
        self.imap_user = imap_user or smtp_user
        self.imap_password = imap_password or smtp_password

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
                context = ssl.create_default_context()
                smtp = smtplib.SMTP_SSL(self.smtp_host, smtp_port, timeout=30, context=context)
            else:
                try:
                    smtp = smtplib.SMTP(self.smtp_host, smtp_port, timeout=30)
                    smtp.starttls()
                except (smtplib.SMTPServerDisconnected, ConnectionResetError, ssl.SSLError) as e:
                    if smtp_port == 587:
                        logger.warning('STARTTLS failed on port 587, retrying with SSL: %s', e)
                        context = ssl.create_default_context()
                        smtp = smtplib.SMTP_SSL(self.smtp_host, smtp_port, timeout=30, context=context)
                    else:
                        raise
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
            # Try to save to IMAP Sent folder
            imap_res = self._save_to_imap_sent(msg_obj)
        finally:
            smtp.quit()

        res = {'success': True, 'message_id': message_id}
        if imap_res:
            res.update(imap_res)
        return res

    def _save_to_imap_sent(self, msg_obj):
        """Save sent email to IMAP Sent folder"""
        if not self.imap_host:
            # No IMAP config, skip saving to Sent folder
            return None

        if 'fastmail' not in self.smtp_host:
            logger.info('Skip IMAP save: provider %s automatically saves sent emails', self.smtp_host)
            return None

        try:
            imap = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, timeout=30)
            imap.login(self.imap_user, self.imap_password)
        except Exception as e:
            logger.warning('Failed to connect to IMAP: %s', e)
            return None

        try:
            sent_folder = self._find_sent_folder(imap)
            folder_to_append = f'"{sent_folder}"' if ' ' in sent_folder else sent_folder
            status, res_data = imap.append(
                folder_to_append,
                '(\\Seen)',
                imaplib.Time2Internaldate(time.time()),
                msg_obj.as_bytes()
            )
            logger.info('Email saved to Sent folder: %s', sent_folder)

            # Extract UID from append response
            # Format: ('OK', [b'[APPENDUID 1234567890 123] Append completed.'])
            uid = None
            if status == 'OK' and res_data and len(res_data) > 0:
                res_str = res_data[0].decode('utf-8') if isinstance(res_data[0], bytes) else str(res_data[0])
                match = re.search(r'APPENDUID\s+\d+\s+(\d+)', res_str)
                if match:
                    uid = int(match.group(1))

            # For Fastmail, fetch EMAILID extension using the UID
            email_id = None
            thread_id = None
            if uid and 'fastmail' in self.imap_host:
                try:
                    # Select Sent folder and fetch EMAILID extension
                    imap.select(f'"{sent_folder}"', readonly=True)
                    # Fastmail supports EMAILID and THREADID extensions
                    status, fetch_data = imap.uid('FETCH', str(uid), '(EMAILID THREADID)')
                    if status == 'OK' and fetch_data:
                        # Parse EMAILID from response like: b'123 (EMAILID "abc123" THREADID "xyz789")'
                        for item in fetch_data:
                            if item:
                                item_str = item.decode('utf-8') if isinstance(item, bytes) else str(item)
                                # Extract EMAILID - handle formats: EMAILID "value", EMAILID (value), EMAILID value
                                email_match = re.search(r'EMAILID\s+["(]?([^\s")]+)[")?]?', item_str)
                                if email_match:
                                    email_id = email_match.group(1)
                                # Extract THREADID
                                thread_match = re.search(r'THREADID\s+["(]?([^\s")]+)[")?]?', item_str)
                                if thread_match:
                                    thread_id = thread_match.group(1)
                    imap.close()
                except Exception as e:
                    logger.warning('Failed to fetch EMAILID from Fastmail: %s', e)
            result = {'imap_folder': sent_folder}
            if uid:
                result['imap_uid'] = uid
            if email_id:
                result['email_id'] = email_id
            if thread_id:
                result['origin_thread_id'] = thread_id
            return result
        except Exception as e:
            logger.warning('Failed to save to Sent folder: %s', e)
            return None
        finally:
            try:
                imap.logout()
            except:
                pass

    def _find_sent_folder(self, imap):
        """Locate the Sent folder using the \\Sent attribute standard"""
        status, folders = imap.list()
        if status == 'OK':
            for folder in folders:
                folder_str = folder.decode('utf-8') if isinstance(folder, bytes) else folder
                if '\\Sent' in folder_str:
                    match = re.search(r'\s+"?([^"]+)"?\s*$', folder_str)
                    if match:
                        return match.group(1).strip('"')

        # Fallback: try common names
        for name in ['Sent', 'Sent Messages', 'INBOX.Sent', 'sent']:
            try:
                status, _ = imap.select(f'"{name}"', readonly=True)
                if status == 'OK':
                    imap.close()
                    return name
            except:
                continue

        return 'Sent'

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
        smtp_port = config.get('smtp_port', 465)
        username = config.get('username')
        password = config.get('password')

        sender_email = config.get('sender_email') or username
        sender_name = config.get('sender_name', '')

        # IMAP config for saving sent emails
        imap_host = config.get('imap_host')
        imap_port = config.get('imap_port')
        imap_user = config.get('username')
        imap_password = config.get('password')

        return SMTPEmailSender(
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            smtp_user=username,
            smtp_password=password,
            sender_name=sender_name,
            sender_email=sender_email,
            imap_host=imap_host,
            imap_port=imap_port,
            imap_user=imap_user,
            imap_password=imap_password,

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
