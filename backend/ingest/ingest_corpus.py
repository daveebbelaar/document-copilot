"""
CLI script to ingest downloaded SEC filings: parse, chunk, embed, and store in Supabase.

Usage:
  # Ingest 1 filing to verify end-to-end:
  uv run ingest/ingest_corpus.py --limit 1

  # Ingest only Apple filings:
  uv run ingest/ingest_corpus.py --ticker AAPL

  # Ingest the full corpus:
  uv run ingest/ingest_corpus.py
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Ensure backend root is on sys.path for direct script execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.documents import count_corpus, store_document_chunks, upsert_source_document
from app.database.session import SessionLocal
from app.ingest.embedder import EmbeddingGenerator
from app.ingest.loader import load_manifest, process_filing_file


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest SEC 10-K filings into Supabase Postgres with pgvector embeddings."
    )
    parser.add_argument(
        "--downloads-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent.parent / "data" / "downloads",
        help="Path to downloaded SEC files directory.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of filings to ingest.",
    )
    parser.add_argument(
        "--ticker",
        type=str,
        default=None,
        help="Only ingest filings for this specific ticker (e.g. AAPL, NVDA).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and chunk only, do not generate embeddings or write to database.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    downloads_dir: Path = args.downloads_dir

    if not downloads_dir.exists():
        print(f"Error: Downloads directory {downloads_dir} does not exist.", file=sys.stderr)
        sys.exit(1)

    manifest_filings = load_manifest(downloads_dir)
    if args.ticker:
        target_ticker = args.ticker.upper()
        manifest_filings = [
            f for f in manifest_filings if f.get("ticker", "").upper() == target_ticker
        ]

    if args.limit:
        manifest_filings = manifest_filings[: args.limit]

    print("\n==================================================")
    print("Document Copilot — SEC Corpus Ingestion")
    print("==================================================")
    print(f"Filings to process : {len(manifest_filings)}")
    print(f"Downloads directory: {downloads_dir}")
    print(f"Dry run mode       : {args.dry_run}\n")

    embedder = None if args.dry_run else EmbeddingGenerator()
    db = SessionLocal()

    total_chunks_stored = 0
    start_time = time.time()

    try:
        for idx, filing in enumerate(manifest_filings, start=1):
            ticker = filing.get("ticker", "")
            accession = filing.get("accession_number", "")
            print(f"[{idx}/{len(manifest_filings)}] Processing {ticker} ({accession})...")

            f_start = time.time()
            doc, chunks = process_filing_file(downloads_dir, filing)
            print(f"  Parsed {len(doc.content_markdown):,} chars into {len(chunks)} chunks")

            if args.dry_run:
                continue

            # Store document metadata
            doc_record = upsert_source_document(db, doc)

            # Generate vector embeddings
            print(f"  Generating embeddings for {len(chunks)} chunks with {embedder.model}...")
            chunk_texts = [c.chunk_text for c in chunks]
            embeddings = embedder.generate_embeddings(chunk_texts)

            # Store chunks & vectors
            stored = store_document_chunks(
                db=db,
                document_id=doc_record.id,
                chunks=chunks,
                embeddings=embeddings,
            )
            total_chunks_stored += stored
            elapsed = time.time() - f_start
            print(f"  ✓ Stored {stored} chunks in {elapsed:.1f}s\n")

    finally:
        db.close()

    total_elapsed = time.time() - start_time
    print("\n==================================================")
    print(f"Ingestion Completed in {total_elapsed:.1f}s")
    if not args.dry_run:
        with SessionLocal() as db_session:
            counts = count_corpus(db_session)
        print(f"Corpus in Database: {counts['documents']} documents, {counts['chunks']} chunks")
        if embedder:
            print(f"Total Tokens Used : {embedder.total_tokens_used:,}")
    print("==================================================\n")


if __name__ == "__main__":
    main()
