"""Add Row-Level Security (RLS) policies for user data isolation.

Revision ID: 002
Revises: 001
Create Date: 2026-10-26

Applies RLS policies to:
  - profiles: users manage only their own profile row
  - chat_threads: users manage only threads where user_id = auth.uid()
  - chat_messages: users access messages belonging to their threads
  - message_citations: users access citations linked to their messages
  - source_documents & document_chunks: read-only access for all authenticated users
"""
from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. profiles policies
    # ------------------------------------------------------------------
    op.execute(
        """
        CREATE POLICY "profiles_select_own"
        ON profiles FOR SELECT
        USING (auth.uid() = id);
        """
    )
    op.execute(
        """
        CREATE POLICY "profiles_insert_own"
        ON profiles FOR INSERT
        WITH CHECK (auth.uid() = id);
        """
    )
    op.execute(
        """
        CREATE POLICY "profiles_update_own"
        ON profiles FOR UPDATE
        USING (auth.uid() = id);
        """
    )

    # ------------------------------------------------------------------
    # 2. chat_threads policies
    # ------------------------------------------------------------------
    op.execute(
        """
        CREATE POLICY "threads_select_own"
        ON chat_threads FOR SELECT
        USING (auth.uid() = user_id);
        """
    )
    op.execute(
        """
        CREATE POLICY "threads_insert_own"
        ON chat_threads FOR INSERT
        WITH CHECK (auth.uid() = user_id);
        """
    )
    op.execute(
        """
        CREATE POLICY "threads_update_own"
        ON chat_threads FOR UPDATE
        USING (auth.uid() = user_id);
        """
    )
    op.execute(
        """
        CREATE POLICY "threads_delete_own"
        ON chat_threads FOR DELETE
        USING (auth.uid() = user_id);
        """
    )

    # ------------------------------------------------------------------
    # 3. chat_messages policies (scoped via thread ownership)
    # ------------------------------------------------------------------
    op.execute(
        """
        CREATE POLICY "messages_select_own_thread"
        ON chat_messages FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM chat_threads
                WHERE chat_threads.id = chat_messages.thread_id
                  AND chat_threads.user_id = auth.uid()
            )
        );
        """
    )
    op.execute(
        """
        CREATE POLICY "messages_insert_own_thread"
        ON chat_messages FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM chat_threads
                WHERE chat_threads.id = chat_messages.thread_id
                  AND chat_threads.user_id = auth.uid()
            )
        );
        """
    )
    op.execute(
        """
        CREATE POLICY "messages_delete_own_thread"
        ON chat_messages FOR DELETE
        USING (
            EXISTS (
                SELECT 1 FROM chat_threads
                WHERE chat_threads.id = chat_messages.thread_id
                  AND chat_threads.user_id = auth.uid()
            )
        );
        """
    )

    # ------------------------------------------------------------------
    # 4. message_citations policies
    # ------------------------------------------------------------------
    op.execute(
        """
        CREATE POLICY "citations_select_own_message"
        ON message_citations FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM chat_messages
                JOIN chat_threads ON chat_threads.id = chat_messages.thread_id
                WHERE chat_messages.id = message_citations.message_id
                  AND chat_threads.user_id = auth.uid()
            )
        );
        """
    )
    op.execute(
        """
        CREATE POLICY "citations_insert_own_message"
        ON message_citations FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM chat_messages
                JOIN chat_threads ON chat_threads.id = chat_messages.thread_id
                WHERE chat_messages.id = message_citations.message_id
                  AND chat_threads.user_id = auth.uid()
            )
        );
        """
    )

    # ------------------------------------------------------------------
    # 5. source_documents & document_chunks policies (read-only for all auth users)
    # ------------------------------------------------------------------
    op.execute(
        """
        CREATE POLICY "documents_select_authenticated"
        ON source_documents FOR SELECT
        TO authenticated
        USING (true);
        """
    )
    op.execute(
        """
        CREATE POLICY "chunks_select_authenticated"
        ON document_chunks FOR SELECT
        TO authenticated
        USING (true);
        """
    )


def downgrade() -> None:
    op.execute('DROP POLICY IF EXISTS "chunks_select_authenticated" ON document_chunks')
    op.execute('DROP POLICY IF EXISTS "documents_select_authenticated" ON source_documents')
    op.execute('DROP POLICY IF EXISTS "citations_insert_own_message" ON message_citations')
    op.execute('DROP POLICY IF EXISTS "citations_select_own_message" ON message_citations')
    op.execute('DROP POLICY IF EXISTS "messages_delete_own_thread" ON chat_messages')
    op.execute('DROP POLICY IF EXISTS "messages_insert_own_thread" ON chat_messages')
    op.execute('DROP POLICY IF EXISTS "messages_select_own_thread" ON chat_messages')
    op.execute('DROP POLICY IF EXISTS "threads_delete_own" ON chat_threads')
    op.execute('DROP POLICY IF EXISTS "threads_update_own" ON chat_threads')
    op.execute('DROP POLICY IF EXISTS "threads_insert_own" ON chat_threads')
    op.execute('DROP POLICY IF EXISTS "threads_select_own" ON chat_threads')
    op.execute('DROP POLICY IF EXISTS "profiles_update_own" ON profiles')
    op.execute('DROP POLICY IF EXISTS "profiles_insert_own" ON profiles')
    op.execute('DROP POLICY IF EXISTS "profiles_select_own" ON profiles')
