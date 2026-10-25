"""
Alembic environment configuration for Document Copilot.

Key behaviors:
- Reads the database URL from app.config.settings (not from alembic.ini).
- Imports app.database.models.Base so autogenerate can detect schema diffs.
- Uses a direct synchronous psycopg connection (not the pooler URL) — required
  for DDL, extension creation, and index builds that need session-level behavior.
- Both online and offline modes are supported (online is the normal path).
"""
from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings

# Alembic supplies the logging configuration from alembic.ini.
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so Base.metadata is fully populated before autogenerate runs.
# Adding a new model file? Import it here too.
import app.database.models  # noqa: F401, E402

from app.database.models import Base  # noqa: E402

target_metadata = Base.metadata

# Override the URL at runtime from the single settings source of truth.
# The alembic.ini sqlalchemy.url is intentionally left blank.
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    In offline mode, Alembic emits SQL to stdout without actually connecting to
    the database. Useful for generating migration scripts to review before applying.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Compare server defaults so Alembic detects DEFAULT changes.
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode (the normal path).

    Creates a real database connection, begins a transaction, and applies
    pending migrations.  NullPool is intentional: Alembic runs once and exits,
    so we do not want a persistent connection pool.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
