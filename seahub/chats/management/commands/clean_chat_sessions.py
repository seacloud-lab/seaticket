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
        total_tool_calls = 0
        total_sessions = 0

        with connection.cursor() as cursor:
            # delete chat sessions, messages, and tool calls
            while True:
                cursor.execute("""
                    DELETE FROM chat_messages 
                    WHERE session_uuid IN (
                        SELECT session_uuid 
                        FROM chat_sessions 
                        WHERE updated_at < %s
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
                    WHERE session_uuid IN (
                        SELECT session_uuid 
                        FROM chat_sessions 
                        WHERE updated_at < %s
                    )
                    LIMIT %s
                """, [cutoff_date, batch_size])
                deleted = cursor.rowcount
                if deleted == 0:
                    break
                total_tool_calls += deleted
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
                WHERE session_uuid NOT IN (
                    SELECT session_uuid FROM chat_sessions
                )
            """)
            orphan_messages = cursor.rowcount
            
            cursor.execute("""
                DELETE FROM chat_message_thought_process 
                WHERE session_uuid NOT IN (
                    SELECT session_uuid FROM chat_sessions
                )
            """)
            orphan_tool_calls = cursor.rowcount

        self.stdout.write(
            f"Deleted {total_sessions} sessions, "
            f"{total_messages + orphan_messages} messages, "
            f"{total_tool_calls + orphan_tool_calls} tool calls."
        )
