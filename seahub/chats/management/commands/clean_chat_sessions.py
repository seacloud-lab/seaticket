import logging
from datetime import timedelta
import time

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone

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
        batch_size = 1000        
        total_messages = 0
        total_message_thought_process = 0
        total_sessions = 0

        with connection.cursor() as cursor:
            # delete chat sessions, messages, and tool calls
            while True:
                cursor.execute("""
                    DELETE FROM chat_messages
                    WHERE EXISTS (
                        SELECT 1 FROM chat_sessions
                        WHERE session_uuid = chat_messages.session_uuid
                        AND updated_at < %s
                    )
                    LIMIT %s
                """, [cutoff_date, batch_size])
                deleted = cursor.rowcount
                if deleted == 0:
                    break
                total_messages += deleted
                time.sleep(0.1)
            
            while True:
                cursor.execute("""
                    DELETE FROM chat_message_thought_process
                    WHERE EXISTS (
                        SELECT 1 FROM chat_sessions
                        WHERE session_uuid = chat_message_thought_process.session_uuid
                        AND updated_at < %s
                    )
                    LIMIT %s
                """, [cutoff_date, batch_size])
                deleted = cursor.rowcount
                if deleted == 0:
                    break
                total_message_thought_process += deleted
                time.sleep(0.1)
            
            while True:
                cursor.execute("""
                    DELETE FROM chat_sessions
                    WHERE updated_at < %s
                    LIMIT %s
                """, [cutoff_date, batch_size])
                deleted = cursor.rowcount
                if deleted == 0:
                    break
                total_sessions += deleted
                time.sleep(0.1)                
            # clean up orphaned messages and tool calls
            cursor.execute("""
                DELETE FROM chat_messages
                WHERE NOT EXISTS (
                    SELECT 1 FROM chat_sessions
                    WHERE session_uuid = chat_messages.session_uuid
                )
            """)
            orphan_messages = cursor.rowcount

            cursor.execute("""
                DELETE FROM chat_message_thought_process
                WHERE NOT EXISTS (
                    SELECT 1 FROM chat_sessions
                    WHERE session_uuid = chat_message_thought_process.session_uuid
                )
            """)
            orphan_message_thought_process = cursor.rowcount

        self.stdout.write(
            f"Deleted {total_sessions} sessions, "
            f"{total_messages + orphan_messages} messages, "
            f"{total_message_thought_process + orphan_message_thought_process} message thought processes."
        )
