"""
Live Grounding Quality Evaluation Script.

Executes live evaluations against the Supabase SEC database and the Grounded AI Agent:
1. Company Factual Extraction & Precision (AAPL 2025)
2. Cross-Company Comparative Synthesis (AAPL vs MSFT 2025)
3. Hallucination Resistance & Refusal (TSLA out-of-corpus)
"""
from __future__ import annotations

import asyncio
import re
import sys
import time
from pathlib import Path
from uuid import uuid4

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.assistant.agent import document_agent
from app.assistant.deps import DocumentAgentDeps
from app.assistant.outputs import GroundedAnswer
from app.auth.schemas import AuthenticatedUser
from app.database.session import SessionLocal
from app.grounding.validator import GroundingValidator
from app.retrieval.retriever import DocumentRetriever


async def run_evaluation() -> None:
    print("\n==================================================")
    print("Document Copilot — Live Grounding Quality Evaluation")
    print("==================================================")

    db = SessionLocal()
    eval_user = AuthenticatedUser(
        id=uuid4(),
        email="evaluator@driftwoodcapital.com",
        role="authenticated",
    )
    thread_id = uuid4()
    validator = GroundingValidator()

    test_cases = [
        {
            "id": "TC-1",
            "name": "Single-Company Factual Retrieval & Exact Citations",
            "query": "What was Apple's total net sales in fiscal 2025, and what were Products vs Services sales?",
            "expected_tickers": ["AAPL"],
            "allow_empty": False,
        },
        {
            "id": "TC-2",
            "name": "Cross-Company Multi-Firm Comparative Grounding",
            "query": "Compare the primary revenue sources and segments reported by Apple and Microsoft in their 2025 10-K filings.",
            "expected_tickers": ["AAPL", "MSFT"],
            "allow_empty": False,
        },
        {
            "id": "TC-3",
            "name": "Hallucination Resistance (Out-of-Corpus Query)",
            "query": "What were Tesla's (TSLA) automotive gross margins and deliveries in fiscal 2025?",
            "expected_tickers": [],
            "allow_empty": True,
        },
    ]

    results = []

    try:
        for tc in test_cases:
            print(f"\n--- Running [{tc['id']}]: {tc['name']} ---")
            print(f"Query: \"{tc['query']}\"")
            t_start = time.time()

            retriever = DocumentRetriever(db=db)
            deps = DocumentAgentDeps(
                user_id=eval_user.id,
                thread_id=thread_id,
                retriever=retriever,
            )

            response = await document_agent.run(
                user_prompt=tc["query"],
                deps=deps,
            )

            elapsed = time.time() - t_start
            raw_output = response.output
            if isinstance(raw_output, str):
                answer = GroundedAnswer(answer=raw_output, citations=[])
            else:
                answer = raw_output
            retrieved_count = len(deps.retrieved_passages)

            # Validate citations
            val_result = validator.validate(
                answer=answer,
                retrieved_passages=deps.retrieved_passages,
            )

            # Check citations in text
            citations_in_text = re.findall(r"\[(\d+)\]", val_result.answer.answer)
            unique_indices = sorted(set(int(i) for i in citations_in_text))

            # Metric: Citation Precision
            citation_precision = (
                val_result.resolved_citations_count / len(val_result.answer.citations)
                if val_result.answer.citations
                else 1.0
            )

            print(f"Elapsed Time       : {elapsed:.2f}s")
            print(f"Passages Retrieved : {retrieved_count}")
            print(f"Citations in Text  : {unique_indices}")
            print(f"Validation Valid   : {val_result.is_valid}")
            print(f"Validation Errors  : {val_result.errors if val_result.errors else 'None'}")
            print(f"\nAgent Response:\n{val_result.answer.answer}\n")

            results.append({
                "id": tc["id"],
                "name": tc["name"],
                "elapsed": elapsed,
                "retrieved_passages": retrieved_count,
                "citations_count": len(val_result.answer.citations),
                "is_valid": val_result.is_valid,
                "errors": val_result.errors,
            })

    finally:
        db.close()

    print("\n==================================================")
    print("Evaluation Summary")
    print("==================================================")
    for r in results:
        status_symbol = "✅ PASS" if r["is_valid"] else "❌ FAIL"
        print(f"[{r['id']}] {status_symbol} — {r['name']} ({r['elapsed']:.1f}s, {r['citations_count']} citations)")
    print("==================================================\n")


if __name__ == "__main__":
    asyncio.run(run_evaluation())
