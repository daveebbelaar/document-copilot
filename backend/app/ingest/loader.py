"""
SEC corpus filing loader and orchestrator for parsing and chunking.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.ingest.chunker import DocumentChunker
from app.ingest.parser import parse_sec_html
from app.ingest.schemas import ChunkData, ParsedDocument

COMPANY_NAMES: dict[str, str] = {
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "NVDA": "NVIDIA Corporation",
    "AMZN": "Amazon.com, Inc.",
    "GOOGL": "Alphabet Inc.",
}


def load_manifest(downloads_dir: Path) -> list[dict]:
    """Load filing entries from the manifest.json in the downloads directory."""
    manifest_file = downloads_dir / "manifest.json"
    if not manifest_file.exists():
        raise FileNotFoundError(f"Manifest not found at {manifest_file}")

    data = json.loads(manifest_file.read_text(encoding="utf-8"))
    return data.get("filings", [])


def process_filing_file(
    downloads_dir: Path,
    filing_entry: dict,
    chunker: DocumentChunker | None = None,
) -> tuple[ParsedDocument, list[ChunkData]]:
    """
    Load an SEC filing from disk, parse its HTML content, and generate chunks.

    Returns:
      (ParsedDocument, list[ChunkData])
    """
    if chunker is None:
        chunker = DocumentChunker()

    local_path = downloads_dir / filing_entry["local_path"]
    if not local_path.exists():
        raise FileNotFoundError(f"Filing file not found at {local_path}")

    raw_html = local_path.read_text(encoding="utf-8", errors="ignore")
    clean_text = parse_sec_html(raw_html)

    ticker = filing_entry.get("ticker", "").upper()
    company_name = COMPANY_NAMES.get(ticker, filing_entry.get("company_name", ticker))

    doc = ParsedDocument(
        accession_number=filing_entry["accession_number"],
        ticker=ticker,
        company_name=company_name,
        form_type=filing_entry.get("form", "10-K"),
        filing_date=filing_entry.get("filing_date", ""),
        report_date=filing_entry.get("report_date", ""),
        source_url=filing_entry.get("source_url", ""),
        content_markdown=clean_text,
        filing_metadata={
            "cik": filing_entry.get("cik"),
            "primary_document": filing_entry.get("primary_document"),
            "local_path": filing_entry.get("local_path"),
            "raw_character_count": len(raw_html),
            "clean_character_count": len(clean_text),
        },
    )

    chunks = chunker.chunk_document(doc)
    return doc, chunks
