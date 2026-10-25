"""
PydanticAI Grounded Document Copilot Agent.
"""
from __future__ import annotations

import structlog
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.assistant.deps import DocumentAgentDeps
from app.assistant.instructions import SYSTEM_INSTRUCTIONS
from app.assistant.outputs import GroundedAnswer
from app.config import settings
from app.retrieval.schemas import RetrievalFilter

logger = structlog.get_logger(__name__)


def create_agent_model() -> OpenAIChatModel:
    """Create the OpenAI-compatible model provider for the agent."""
    provider = OpenAIProvider(
        base_url=settings.openai_base_url,
        api_key=settings.openai_api_key,
    )
    return OpenAIChatModel(
        settings.openai_chat_model,
        provider=provider,
    )


# Typed PydanticAI Agent with DocumentAgentDeps supporting structured GroundedAnswer or raw text
document_agent: Agent[DocumentAgentDeps, GroundedAnswer | str] = Agent(
    create_agent_model(),
    deps_type=DocumentAgentDeps,
    output_type=[GroundedAnswer, str],
    system_prompt=SYSTEM_INSTRUCTIONS,
)


@document_agent.tool
def search_sec_filings(
    ctx: RunContext[DocumentAgentDeps],
    query: str,
    ticker: str | None = None,
    section: str | None = None,
) -> str:
    """
    Search the SEC 10-K filing corpus for evidence using hybrid semantic + full-text search.

    Args:
      query: Specific search question or financial topic (e.g. "iPhone revenue 2024").
      ticker: Optional company stock ticker to restrict search (e.g. "AAPL", "NVDA", "MSFT").
      section: Optional 10-K section filter (e.g. "Item 1A. Risk Factors", "Item 7").

    Returns:
      Numbered source passages formatted with citation indices [1], [2], etc.
    """
    logger.info(
        "Agent executing search_sec_filings tool",
        query=query,
        ticker=ticker,
        section=section,
    )

    filters = RetrievalFilter(ticker=ticker, section=section) if (ticker or section) else None
    passages = ctx.deps.retriever.retrieve(
        query=query,
        limit=settings.retrieval_max_chunks,
        filters=filters,
    )

    if not passages:
        return "No relevant passages found in the SEC filings corpus for the given query."

    # Starting index in the accumulated list for this turn
    start_index = len(ctx.deps.retrieved_passages) + 1
    formatted_passages: list[str] = []

    for idx, passage in enumerate(passages, start=start_index):
        ctx.deps.retrieved_passages.append(passage)
        header = passage.format_citation_header(idx)
        formatted_passages.append(f"{header}\n{passage.chunk_text}")

    return "\n\n---\n\n".join(formatted_passages)
