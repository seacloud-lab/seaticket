import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Subquery

from seahub.chats.models import ChatSessions, ChatMessages, ChatMessageThoughtProcess

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Delete old chat sessions from the database. Default retention period is 90 days."

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Number of days to retain chat history. Default is 90 days (3 months).'
        )

    def handle(self, *args, **options):
        days = options['days']
        cutoff_date = timezone.now() - timedelta(days=days)
        old_sessions = ChatSessions.objects.filter(updated_at__lt=cutoff_date)
        count = old_sessions.count()

        ChatMessages.objects.filter(session_uuid__in=Subquery(old_sessions.values('session_uuid'))).delete()
        ChatMessageThoughtProcess.objects.filter(session_uuid__in=Subquery(old_sessions.values('session_uuid'))).delete()
        old_sessions.delete()

        # Clean up orphan records (session_uuid is null or not in ChatSessions)
        all_session_uuids = ChatSessions.objects.values('session_uuid')
        orphan_messages, _ = ChatMessages.objects.exclude(
            session_uuid__in=Subquery(all_session_uuids)
        ).delete()
        orphan_tool_calls, _ = ChatToolCalls.objects.exclude(
            session_uuid__in=Subquery(all_session_uuids)
        ).delete()

        self.stdout.write(f"Deleted {count} sessions, {orphan_messages} orphan messages, {orphan_tool_calls} orphan tool calls.")
