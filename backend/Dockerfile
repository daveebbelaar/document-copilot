FROM python:3.12-slim-bookworm

# Install uv binary from official Astral image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

# Copy package manifests first for caching
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-install-project --no-dev

# Copy source code, migrations, and alembic config
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

# Sync editable app package
RUN uv sync --frozen --no-dev

ENV PORT=8000
EXPOSE 8000

# Run migrations and launch FastAPI
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
