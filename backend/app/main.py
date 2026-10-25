"""
FastAPI application entrypoint.

This module creates the app, wires up middleware, and includes routers.
It is the only place that should import and configure the ASGI app object.
"""
from __future__ import annotations

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.threads import router as threads_router
from app.config import settings

logger = structlog.get_logger(__name__)

app = FastAPI(
    title="Document Copilot API",
    description="Grounded AI answers from SEC filings — backend service.",
    version="0.1.0",
    # Disable automatic redirect for trailing slashes; avoids CORS preflight issues.
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(threads_router)


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    """
    Liveness probe.

    Returns 200 + a JSON body so load balancers and Railway health checks
    have a lightweight endpoint to poll without triggering any DB or LLM work.
    """
    return {"status": "ok"}


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
