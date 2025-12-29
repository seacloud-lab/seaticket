import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from seahub.chats.models import ChatMessages, ChatSessions, ChatToolCalls

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
        session_uuids = list(old_sessions.values_list('session_uuid', flat=True))

        with transaction.atomic():
            deleted_sessions, _ = old_sessions.delete()
            ChatMessages.objects.filter(session_uuid__in=session_uuids).delete()
            ChatToolCalls.objects.filter(session_uuid__in=session_uuids).delete()

        self.stdout.write(f"Deleted {deleted_sessions} sessions.")
