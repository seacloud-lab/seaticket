import logging
import time
import base64
import smtplib
import ssl
import imaplib
import re
import json
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication
from email.utils import formataddr, parseaddr, formatdate, make_msgid
from urllib import parse

import requests

logger = logging.getLogger(__name__)


class EmailConfigError(Exception):
    """Email configuration error"""
    pass


class EmailSendError(Exception):
    """Email send error"""
    pass


class EmailDeleteError(Exception):
    """Email delete error"""
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
        msg_obj['Date'] = formatdate(localtime=True)

        if not message_id:
            message_id = make_msgid()
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

    def delete_emails(self, email_identifiers):
        """Move emails to Trash on the IMAP server using stored UID only."""
        if not email_identifiers:
            return {'deleted_count': 0, 'failed_count': 0}

        try:
            imap = imaplib.IMAP4_SSL(self.imap_host, self.imap_port or 993, timeout=30)
            imap.login(self.imap_user or self.smtp_user, self.imap_password or self.smtp_password)
        except Exception as e:
            raise EmailDeleteError('Failed to connect to email server for deletion')

        deleted_count = 0
        failed_count = 0
        try:
            trash = self._find_trash_folder(imap)
            sent = self._find_sent_folder(imap)
            folders = ['INBOX', sent] if sent else ['INBOX']
            for ident in email_identifiers:
                try:
                    uid, folder = self._locate_email(imap, folders, ident)
                    if not uid:
                        # Email not found on server (already deleted) — skip
                        deleted_count += 1
                        continue
                    self._move_to_trash(imap, uid, folder, trash)
                    deleted_count += 1
                except Exception as e:
                    logger.exception('Failed to delete email: %s', e)
                    failed_count += 1
        finally:
            try:
                imap.logout()
            except Exception:
                pass

        return {'deleted_count': deleted_count, 'failed_count': failed_count}

    @staticmethod
    def _locate_email(imap, folders, ident):
        """Find email by message_id. Returns (uid, folder) or (None, None)."""
        msg_id = ident.get('message_id')
        if msg_id:
            return SMTPEmailSender._find_by_msgid(imap, folders, msg_id)
        return None, None

    @staticmethod
    def _find_by_msgid(imap, folders, msg_id):
        """Locate an email by Message-ID header."""
        clean = msg_id.strip()
        for folder in folders:
            imap.select(folder, readonly=True)
            status, data = imap.uid('SEARCH', None, f'HEADER Message-ID "{clean}"')
            if status == 'OK' and data and data[0]:
                uids = data[0].split()
                if uids:
                    logger.info('Found email by Message-ID uid=%s in %s', uids[0], folder)
                    imap.close()
                    return int(uids[0]), folder
            imap.close()
        logger.warning('Email not found by Message-ID: %s', clean)
        return None, None

    @staticmethod
    def _move_to_trash(imap, uid, source_folder, trash_folder):
        """Copy email to trash folder, then try to delete original."""
        if not source_folder:
            raise EmailDeleteError(f'Cannot delete uid={uid}: source folder is missing')

        if trash_folder:
            status, _ = imap.select(source_folder, readonly=True)
            if status != 'OK':
                raise EmailDeleteError(f'Failed to select folder {source_folder} for uid={uid}')
            dest = f'"{trash_folder}"' if ' ' in trash_folder else trash_folder
            status, _ = imap.uid('COPY', str(uid), dest)
            if status != 'OK':
                raise EmailDeleteError(f'Failed to copy uid={uid} from {source_folder} to {trash_folder}')
            logger.info('Copied uid=%s from %s to %s', uid, source_folder, trash_folder)
            imap.close()
            status, _ = imap.select(source_folder, readonly=False)
            if status != 'OK':
                raise EmailDeleteError(f'Failed to reselect folder {source_folder} for uid={uid}')
            status, _ = imap.uid('STORE', str(uid), '+FLAGS', '\\Deleted')
            if status != 'OK':
                raise EmailDeleteError(f'Failed to flag uid={uid} as deleted in {source_folder}')
            status, _ = imap.expunge()
            if status != 'OK':
                raise EmailDeleteError(f'Failed to expunge uid={uid} from {source_folder}')
        else:
            status, _ = imap.select(source_folder, readonly=False)
            if status != 'OK':
                raise EmailDeleteError(f'Failed to select folder {source_folder} for uid={uid}')
            status, _ = imap.uid('STORE', str(uid), '+FLAGS', '\\Deleted')
            if status != 'OK':
                raise EmailDeleteError(f'Failed to flag uid={uid} as deleted in {source_folder}')
            status, _ = imap.expunge()
            if status != 'OK':
                raise EmailDeleteError(f'Failed to expunge uid={uid} from {source_folder}')

    @staticmethod
    def _find_trash_folder(imap):
        """Find the Trash/Deleted Items folder from the server's folder list."""
        TRASH_NAMES = ('Deleted Messages', 'Trash', 'Deleted Items', '已删除', '刪除的郵件', 'INBOX.Trash', 'Deleted', 'Bin')
        status, folder_list = imap.list()
        if status != 'OK':
            return None
        for f in folder_list:
            s = f.decode('utf-8') if isinstance(f, bytes) else f
            if '\\Trash' in s:
                m = re.search(r'\s+"?([^"]+)"?\s*$', s)
                if m: return m.group(1).strip('"')
            m = re.search(r'\s+"?([^"]+)"?\s*$', s)
            if m:
                name = m.group(1).strip('"')
                if name in TRASH_NAMES:
                    return name
        return None

    def _save_to_imap_sent(self, msg_obj):
        """Save sent email to IMAP Sent folder"""
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
            uid = None
            folder_to_append = f'"{sent_folder}"' if ' ' in sent_folder else sent_folder

            # Check if email is sent only to self - skip IMAP append in that case
            sender_email = self.sender_email.lower()
            to_header = msg_obj.get('To', '')
            cc_header = msg_obj.get('Cc', '')

            all_recipients = []
            if to_header:
                all_recipients.extend([parseaddr(addr)[1].lower() for addr in to_header.split(',')])
            if cc_header:
                all_recipients.extend([parseaddr(addr)[1].lower() for addr in cc_header.split(',')])

            if all_recipients and not all(addr == sender_email for addr in all_recipients):
                # Append email to Sent folder
                status, res_data = imap.append(
                    folder_to_append,
                    '(\\Seen)',
                    imaplib.Time2Internaldate(time.time()),
                    msg_obj.as_bytes()
                )
                logger.info('Email saved to Sent folder: %s', sent_folder)

                # Extract UID from append response
                # Format: ('OK', [b'[APPENDUID 1234567890 123] Append completed.'])
                if status == 'OK' and res_data and len(res_data) > 0:
                    res_str = res_data[0].decode('utf-8') if isinstance(res_data[0], bytes) else str(res_data[0])
                    match = re.search(r'APPENDUID\s+\d+\s+(\d+)', res_str)
                    if match:
                        uid = int(match.group(1))
            else:
                # Email sent to self - search in INBOX to get uid
                message_id = msg_obj.get('Message-ID', '')
                if message_id:
                    try:
                        imap.select('INBOX', readonly=True)
                        # Search by Message-ID
                        status, search_data = imap.uid('SEARCH', None, f'HEADER Message-ID "{message_id}"')
                        if status == 'OK' and search_data and search_data[0]:
                            uid_strs = search_data[0].split()
                            if uid_strs:
                                uid = int(uid_strs[0])
                                logger.info('Found email in INBOX with uid: %s', uid)
                    except Exception as e:
                        logger.warning('Failed to search email in INBOX: %s', e)
                    finally:
                        try:
                            imap.close()
                        except:
                            pass

            # For Fastmail, fetch EMAILID and THREADID
            email_id = None
            thread_id = None
            if uid:
                try:
                    for folder in [sent_folder, "INBOX"]:
                        imap.select(folder, readonly=True)
                        status, fetch_data = imap.uid('FETCH', str(uid), '(EMAILID THREADID)')
                        if status == 'OK' and fetch_data:
                            for item in fetch_data:
                                if item:
                                    item_str = item.decode('utf-8') if isinstance(item, bytes) else str(item)
                                    # Extract EMAILID
                                    email_match = re.search(r'EMAILID\s+["(]?([^\s")]+)[")?]?', item_str)
                                    if email_match:
                                        email_id = email_match.group(1)
                                    # Extract THREADID
                                    thread_match = re.search(r'THREADID\s+["(]?([^\s")]+)[")?]?', item_str)
                                    if thread_match:
                                        thread_id = thread_match.group(1)
                        if email_id and thread_id:
                            break

                except Exception as e:
                    logger.warning('Failed to fetch EMAILID/THREADID from IMAP: %s', e)
                finally:
                    try:
                        imap.close()
                    except:
                        pass
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
        self.config_updated = False
        self.client_id = config.get('client_id')
        self.client_secret = config.get('client_secret')
        self.refresh_token = config.get('refresh_token')
        self.access_token = config.get('access_token')
        self.sender_name = config.get('sender_name', '')
        self.sender_email = config.get('sender_email')
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
        self.config_updated = True

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

        email_id = None
        try:
            response_data = response.json()
        except Exception:
            response_data = {}
        if isinstance(response_data, dict):
            email_id = response_data.get('id')

        return {
            'success': success,
            'message_id': message_id,
            'email_id': email_id,
            'config_updated': self.config_updated,
        }


class GmailSender(_OAuthEmailSender):
    """Gmail API email sender"""

    EMAIL_SENDING_ENDPOINT = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart'
    GMAIL_TRASH_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}/trash'

    def _do_send_email(self, msg_obj):
        msg_string = msg_obj.as_string()

        metadata = {}

        boundary = 'mail_boundary'

        body_parts = [
            f'--{boundary}',
            'Content-Type: application/json; charset=UTF-8',
            '',
            json.dumps(metadata),
            f'--{boundary}',
            f'Content-Type: message/rfc822',
            '',
            msg_string,
            f'--{boundary}--'
        ]
        request_body = '\r\n'.join(body_parts)

        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': f'multipart/related; boundary={boundary}'
        }

        return requests.post(
            self.EMAIL_SENDING_ENDPOINT,
            data=request_body,
            headers=headers
        )

    def delete_emails(self, email_identifiers):
        """
        Move emails to Trash via Gmail API.

        email_identifiers: list of dicts with keys:
            - email_id: Gmail message ID (required)
        Returns: dict with 'deleted_count' and 'failed_count'
        """
        if not email_identifiers:
            return {'deleted_count': 0, 'failed_count': 0}

        self._request_access_token()

        deleted_count = 0
        failed_count = 0

        for identifier in email_identifiers:
            remote_message_id = identifier.get('message_id')
            if not remote_message_id:
                failed_count += 1
                continue

            try:
                trash_url = self.GMAIL_TRASH_ENDPOINT.format(message_id=remote_message_id)
                response = requests.post(trash_url, headers={
                    'Authorization': f'Bearer {self.access_token}',
                })
                _check_and_raise_error(response)
                deleted_count += 1
            except Exception as e:
                logger.exception('Failed to trash Gmail message %s: %s', remote_message_id, e)
                failed_count += 1

        return {'deleted_count': deleted_count, 'failed_count': failed_count}


class MicrosoftSender(_OAuthEmailSender):
    """Microsoft API email sender"""

    EMAIL_SENDING_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/sendMail'
    MS_GRAPH_MESSAGE_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/messages/{message_id}/move'

    def _do_send_email(self, msg_obj):
        msg_bytes = msg_obj.as_bytes()
        msg_base64 = base64.b64encode(msg_bytes).decode()

        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'text/plain'
        }

        return requests.post(self.EMAIL_SENDING_ENDPOINT, data=msg_base64, headers=headers)

    def delete_emails(self, email_identifiers):
        """
        Move emails to Deleted Items via Microsoft Graph API.

        email_identifiers: list of dicts with keys:
            - message_id: Microsoft message ID (required)
        Returns: dict with 'deleted_count' and 'failed_count'
        """
        if not email_identifiers:
            return {'deleted_count': 0, 'failed_count': 0}

        self._request_access_token()

        deleted_count = 0
        failed_count = 0

        for identifier in email_identifiers:
            remote_message_id = identifier.get('message_id')
            if not remote_message_id:
                failed_count += 1
                continue

            try:
                move_url = self.MS_GRAPH_MESSAGE_ENDPOINT.format(message_id=remote_message_id)
                response = requests.post(move_url, json={
                    'destinationId': 'deleteditems'
                }, headers={
                    'Authorization': f'Bearer {self.access_token}',
                    'Content-Type': 'application/json',
                })
                _check_and_raise_error(response)
                deleted_count += 1
            except Exception as e:
                logger.exception('Failed to delete Microsoft message %s: %s', remote_message_id, e)
                failed_count += 1

        return {'deleted_count': deleted_count, 'failed_count': failed_count}


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
    elif server_provider == 'Microsoft':
        return MicrosoftSender(config)
    else:
        logger.error('Invalid server_provider: %s', server_provider)
        raise EmailConfigError(f'Invalid server_provider: {server_provider}')


def toggle_send_email(config, send_info):
    sender = get_email_sender_from_config(config)
    return sender.send(send_info)


def toggle_delete_emails(config, email_identifiers):
    sender = get_email_sender_from_config(config)
    return sender.delete_emails(email_identifiers)
