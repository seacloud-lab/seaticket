"""Mailbox managers for account-level mailbox operations.

Unlike ``email_sender`` (which is only responsible for sending email), this
module manages mailbox-side operations such as moving messages into the
junk/spam folder.

The class hierarchy mirrors the email sender / mail viewer conventions so that
new providers can be added incrementally:

- ``BaseMailboxManager``: shared interface.
- ``ImapMailboxManager``: IMAP implementation (general email provider).
- ``OAuthMailboxManager`` (future): base for OAuth providers (Gmail/Microsoft).
"""
import imaplib
import logging
import re

logger = logging.getLogger(__name__)


class MailboxConfigError(Exception):
    """Mailbox configuration error."""
    pass


class MailboxOperationError(Exception):
    """Mailbox operation error (connect / search / move failure)."""
    pass


class BaseMailboxManager:
    """Base class for mailbox managers.

    Subclasses implement provider-specific logic (IMAP today, OAuth-based
    Gmail/Microsoft later).
    """

    def __init__(self, config):
        self.config = config or {}
        self.config_updated = False

    def move_to_junk(self, message_ids):
        """Move messages (identified by their Message-ID headers) to the
        junk/spam folder.

        Returns a dict: ``{'moved_count': int, 'target_folder': str}``.
        """
        raise NotImplementedError


class ImapMailboxManager(BaseMailboxManager):
    """IMAP-based mailbox manager for the general email provider."""

    # NetEase IMAP servers reject SELECT with "Unsafe Login" unless the client
    # identifies itself via the IMAP ID extension (RFC 2971) after login.
    _IMAP_ID_REQUIRED_HOSTS = ('163.com', '126.com', 'yeah.net')

    # Fallback junk folder names for servers without SPECIAL-USE support.
    _JUNK_FOLDER_FALLBACK_NAMES = [
        'Junk', 'Spam', 'Junk E-mail', 'Junk Mail', 'INBOX.Junk', 'INBOX.Spam',
    ]

    _CONNECT_TIMEOUT = 30

    def __init__(self, config):
        super().__init__(config)
        self.imap_host = config.get('imap_host')
        self.imap_port = config.get('imap_port') or 993
        self.imap_user = config.get('username')
        self.imap_password = config.get('password')
        if not all([self.imap_host, self.imap_user, self.imap_password]):
            raise MailboxConfigError('Email configuration is incomplete for IMAP mailbox operations.')

    @staticmethod
    def _decode_imap_line(raw_line):
        if isinstance(raw_line, bytes):
            return raw_line.decode('utf-8', errors='ignore')
        return str(raw_line or '')

    @classmethod
    def _extract_imap_folder_name(cls, list_line):
        line = cls._decode_imap_line(list_line)
        match = re.search(r'\s+"?([^"]+)"?\s*$', line)
        if match:
            return match.group(1).strip('"')
        return ''

    @staticmethod
    def _quote_imap_folder(folder_name):
        if not folder_name:
            return folder_name
        return f'"{folder_name}"' if ' ' in folder_name else folder_name

    def _send_imap_id(self, imap_conn):
        host = (self.imap_host or '').lower()
        if not any(domain in host for domain in self._IMAP_ID_REQUIRED_HOSTS):
            return
        try:
            imaplib.Commands['ID'] = ('AUTH', 'SELECTED')
            identification = '("name" "seaqa" "vendor" "haiwen")'
            typ, dat = imap_conn._simple_command('ID', identification)
            imap_conn._untagged_response(typ, dat, 'ID')
        except Exception as e:
            logger.warning('Failed to send IMAP ID command to %s: %s', self.imap_host, e)

    def _find_junk_folder(self, imap_conn):
        status, folders = imap_conn.list()
        if status == 'OK':
            for folder in folders or []:
                folder_str = self._decode_imap_line(folder)
                if '\\Junk' in folder_str:
                    folder_name = self._extract_imap_folder_name(folder_str)
                    if folder_name:
                        return folder_name

        for name in self._JUNK_FOLDER_FALLBACK_NAMES:
            quoted = self._quote_imap_folder(name)
            try:
                check_status, _ = imap_conn.select(quoted, readonly=True)
                if check_status == 'OK':
                    imap_conn.close()
                    return name
            except Exception:
                continue

        return ''

    @staticmethod
    def _normalize_message_ids(message_ids):
        normalized = []
        for message_id in message_ids or []:
            value = str(message_id or '').strip()
            if value:
                normalized.append(value)
        return normalized

    def _connect(self):
        imap = imaplib.IMAP4_SSL(self.imap_host, int(self.imap_port), timeout=self._CONNECT_TIMEOUT)
        imap.login(self.imap_user, self.imap_password)
        self._send_imap_id(imap)
        return imap

    def move_to_junk(self, message_ids):
        normalized_message_ids = self._normalize_message_ids(message_ids)
        if not normalized_message_ids:
            return {'moved_count': 0, 'target_folder': ''}

        imap = None
        try:
            imap = self._connect()

            junk_folder = self._find_junk_folder(imap)
            if not junk_folder:
                raise MailboxOperationError('Unable to locate junk/spam folder.')
            quoted_junk_folder = self._quote_imap_folder(junk_folder)

            status, _ = imap.select('INBOX')
            if status != 'OK':
                raise MailboxOperationError('Failed to open INBOX folder.')

            uid_set = set()
            for message_id in normalized_message_ids:
                status, data = imap.uid('SEARCH', None, f'HEADER Message-ID "{message_id}"')
                if status != 'OK' or not data or not data[0]:
                    continue
                for uid in data[0].split():
                    if uid:
                        uid_set.add(uid.decode() if isinstance(uid, bytes) else str(uid))

            if not uid_set:
                return {'moved_count': 0, 'target_folder': junk_folder}

            uid_csv = ','.join(sorted(uid_set))
            capability_status, capability_data = imap.capability()
            supports_move = False
            if capability_status == 'OK':
                capability_text = ' '.join(self._decode_imap_line(item) for item in capability_data or [])
                supports_move = 'MOVE' in capability_text.upper()

            if supports_move:
                move_status, _ = imap.uid('MOVE', uid_csv, quoted_junk_folder)
                if move_status != 'OK':
                    raise MailboxOperationError('IMAP MOVE command failed.')
            else:
                copy_status, _ = imap.uid('COPY', uid_csv, quoted_junk_folder)
                if copy_status != 'OK':
                    raise MailboxOperationError('IMAP COPY command failed.')
                store_status, _ = imap.uid('STORE', uid_csv, '+FLAGS', '(\\Deleted)')
                if store_status != 'OK':
                    raise MailboxOperationError('IMAP STORE command failed.')
                expunge_status, _ = imap.expunge()
                if expunge_status != 'OK':
                    raise MailboxOperationError('IMAP EXPUNGE command failed.')

            return {'moved_count': len(uid_set), 'target_folder': junk_folder}
        except (MailboxConfigError, MailboxOperationError):
            raise
        except Exception as e:
            logger.exception('Failed to move emails to junk via IMAP: %s', e)
            raise MailboxOperationError('Failed to move emails to junk.')
        finally:
            if imap:
                try:
                    imap.logout()
                except Exception:
                    pass


def get_mailbox_manager_from_config(config):
    server_provider = config.get('server_provider', 'general_email_provider')

    if server_provider == 'general_email_provider':
        return ImapMailboxManager(config)

    # OAuth providers (Gmail/Microsoft) are not supported yet.
    logger.error('Mailbox manager not supported for server_provider: %s', server_provider)
    raise MailboxConfigError(f'Mailbox operations are not supported for provider: {server_provider}')


def move_emails_to_junk(config, message_ids):
    manager = get_mailbox_manager_from_config(config)
    return manager.move_to_junk(message_ids)


__all__ = [
    'MailboxConfigError',
    'MailboxOperationError',
    'BaseMailboxManager',
    'ImapMailboxManager',
    'get_mailbox_manager_from_config',
    'move_emails_to_junk',
]
