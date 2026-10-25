"""
Unit tests for SEC document parsing, section splitting, and chunking pipeline.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.ingest.chunker import DocumentChunker, estimate_token_count
from app.ingest.loader import COMPANY_NAMES, load_manifest, process_filing_file
from app.ingest.parser import parse_sec_html, split_into_sections
from app.ingest.schemas import ParsedDocument


def test_parse_sec_html_strips_scripts_and_styles() -> None:
    """HTML parser must strip script, style, and ix:header tags completely."""
    raw_html = """
    <html>
        <head>
            <style>body { font-size: 12px; } .hidden { display: none; }</style>
            <script>function track() { return 42; }</script>
        </head>
        <body>
            <ix:header><ix:hidden>XBRL metadata</ix:hidden></ix:header>
            <h1>Apple Inc. Form 10-K</h1>
            <p>Apple designs, manufactures and markets smartphones.</p>
        </body>
    </html>
    """
    clean = parse_sec_html(raw_html)
    assert "font-size" not in clean
    assert "function track" not in clean
    assert "XBRL metadata" not in clean
    assert "Apple Inc. Form 10-K" in clean
    assert "smartphones." in clean


def test_parse_sec_html_unescapes_entities_and_formats_tables() -> None:
    """Parser unescapes HTML entities and structures table rows."""
    html_with_table = """
    <p>Revenue &amp; Net Income for Fiscal 2024&nbsp;&mdash; in millions:</p>
    <table>
        <tr><th>Segment</th><th>Net Sales</th></tr>
        <tr><td>iPhone</td><td>$201,183</td></tr>
        <tr><td>Services</td><td>$96,169</td></tr>
    </table>
    """
    clean = parse_sec_html(html_with_table)
    assert "Revenue & Net Income" in clean
    assert "iPhone" in clean
    assert "$201,183" in clean
    assert "|" in clean  # Table marker present


def test_split_into_sections_identifies_standard_items() -> None:
    """10-K Item headings should be detected and isolated as individual sections."""
    doc_text = """
    UNITED STATES SECURITIES AND EXCHANGE COMMISSION
    Washington, D.C. 20549
    FORM 10-K

    Item 1. Business
    Apple designs, manufactures and markets mobile communication devices.

    Item 1A. Risk Factors
    Global macroeconomic volatility may adversely affect consumer demand.

    Item 7. Management’s Discussion and Analysis of Financial Condition and Results of Operations
    Total net sales were $391,035 million in fiscal year 2024.
    """
    sections = split_into_sections(doc_text)
    assert len(sections) == 4
    titles = [s[0] for s in sections]
    assert titles[0] == "Cover Page / Preamble"
    assert "Item 1. Business" in titles[1]
    assert "Item 1A. Risk Factors" in titles[2]
    assert "Item 7." in titles[3]


def test_split_into_sections_fallback_when_no_items() -> None:
    """When document lacks standard Item headers, return full document as one section."""
    plain_text = "Simple announcement with no standard SEC items."
    sections = split_into_sections(plain_text)
    assert len(sections) == 1
    assert sections[0][0] == "Full Document"
    assert sections[0][1] == plain_text


def test_estimate_token_count() -> None:
    """Token count estimation provides safe lower bound."""
    text = "Word " * 100  # 500 chars
    tokens = estimate_token_count(text)
    assert tokens == 125
    assert estimate_token_count("") == 1


def test_document_chunker_basic() -> None:
    """Chunker produces ordered, section-aware chunks with complete metadata."""
    doc = ParsedDocument(
        accession_number="0000320193-24-000123",
        ticker="AAPL",
        company_name="Apple Inc.",
        form_type="10-K",
        filing_date="2024-11-01",
        report_date="2024-09-28",
        source_url="https://sec.gov/Archives/edgar/data/320193/...",
        content_markdown="""
        Item 1. Business
        Paragraph one about hardware products.

        Paragraph two about software and services ecosystem.

        Item 1A. Risk Factors
        Paragraph one about intense competition in tech markets.

        Paragraph two about supply chain concentration in Asia.
        """,
    )

    chunker = DocumentChunker(target_tokens=50, overlap_tokens=10, min_tokens=5)
    chunks = chunker.chunk_document(doc)

    assert len(chunks) >= 2
    # Chunk indices must be contiguous starting at 0
    indices = [c.chunk_index for c in chunks]
    assert indices == list(range(len(chunks)))

    # Verify metadata envelope
    for chunk in chunks:
        assert chunk.chunk_metadata["ticker"] == "AAPL"
        assert chunk.chunk_metadata["company_name"] == "Apple Inc."
        assert chunk.chunk_metadata["accession_number"] == "0000320193-24-000123"
        assert chunk.token_count > 0


def test_load_manifest_not_found_raises() -> None:
    """load_manifest should raise FileNotFoundError when manifest is missing."""
    with pytest.raises(FileNotFoundError):
        load_manifest(Path("/nonexistent/directory"))


def test_process_filing_file_with_temp_dir(tmp_path: Path) -> None:
    """process_filing_file successfully integrates parsing, metadata, and chunking."""
    manifest_data = {
        "filings": [
            {
                "ticker": "AAPL",
                "cik": "0000320193",
                "form": "10-K",
                "filing_date": "2024-11-01",
                "report_date": "2024-09-28",
                "accession_number": "0000320193-24-000123",
                "source_url": "https://sec.gov/test",
                "local_path": "2024/aapl_test.htm",
            }
        ]
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest_data), encoding="utf-8")
    year_dir = tmp_path / "2024"
    year_dir.mkdir(parents=True)
    html_content = """
    <html><body>
    <h1>Apple Inc.</h1>
    Item 1. Business
    Apple designs the iPhone, Mac, and iPad.
    Item 7. Management’s Discussion and Analysis
    Net sales increased 2% year over year.
    </body></html>
    """
    (year_dir / "aapl_test.htm").write_text(html_content, encoding="utf-8")

    filing_entry = manifest_data["filings"][0]
    doc, chunks = process_filing_file(tmp_path, filing_entry)

    assert doc.ticker == "AAPL"
    assert doc.company_name == COMPANY_NAMES["AAPL"]
    assert doc.form_type == "10-K"
    assert len(chunks) >= 2
    assert any("iPhone" in c.chunk_text for c in chunks)
