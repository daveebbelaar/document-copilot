"""
Unit tests for the PydanticAI Document Copilot agent tools and schemas.
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock

from pydantic_ai import RunContext

from app.assistant.agent import search_sec_filings
from app.assistant.deps import DocumentAgentDeps
from app.retrieval.schemas import SourcePassage


def create_mock_passage(ticker: str, section: str, text: str) -> SourcePassage:
    return SourcePassage(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        chunk_index=0,
        chunk_text=text,
        score=0.025,
        section=section,
        ticker=ticker,
        company_name=f"{ticker} Inc.",
        form_type="10-K",
        filing_date="2025-10-31",
        report_date="2025-09-27",
    )


def test_search_sec_filings_tool_accumulates_passages_and_formats() -> None:
    """Tool calls retriever, appends passages to deps, and returns formatted text."""
    mock_retriever = MagicMock()
    passage1 = create_mock_passage(
        "AAPL", "Item 1. Business", "Apple manufactures consumer hardware."
    )
    passage2 = create_mock_passage("AAPL", "Item 7. MD&A", "Net sales reached record highs.")
    mock_retriever.retrieve.return_value = [passage1, passage2]

    deps = DocumentAgentDeps(
        user_id=uuid.uuid4(),
        thread_id=uuid.uuid4(),
        retriever=mock_retriever,
    )

    # Construct mock RunContext
    ctx = MagicMock(spec=RunContext)
    ctx.deps = deps

    result = search_sec_filings(
        ctx=ctx,
        query="Apple products and net sales",
        ticker="AAPL",
    )

    # 1. Tool called retriever with ticker filter
    assert mock_retriever.retrieve.call_count == 1
    call_kwargs = mock_retriever.retrieve.call_args.kwargs
    assert call_kwargs["query"] == "Apple products and net sales"
    assert call_kwargs["filters"].ticker == "AAPL"

    # 2. Accumulated in deps
    assert len(deps.retrieved_passages) == 2
    assert deps.retrieved_passages[0] == passage1
    assert deps.retrieved_passages[1] == passage2

    # 3. Formatted output contains citation headers
    assert "[1] AAPL 10-K (2025-10-31) | Item 1. Business" in result
    assert "[2] AAPL 10-K (2025-10-31) | Item 7. MD&A" in result
    assert "consumer hardware" in result


def test_search_sec_filings_tool_handles_empty_results() -> None:
    """Tool returns informative message when no passages match."""
    mock_retriever = MagicMock()
    mock_retriever.retrieve.return_value = []

    deps = DocumentAgentDeps(
        user_id=uuid.uuid4(),
        thread_id=uuid.uuid4(),
        retriever=mock_retriever,
    )
    ctx = MagicMock(spec=RunContext)
    ctx.deps = deps

    result = search_sec_filings(ctx=ctx, query="Unknown Topic")
    assert "No relevant passages found" in result
    assert len(deps.retrieved_passages) == 0
