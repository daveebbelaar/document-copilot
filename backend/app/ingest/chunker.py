"""
Document chunking pipeline with section awareness and overlap.
"""
from __future__ import annotations

from app.ingest.parser import split_into_sections
from app.ingest.schemas import ChunkData, ParsedDocument


def estimate_token_count(text: str) -> int:
    """
    Estimate token count without external tokenizer dependency.
    Uses standard 4 chars per token rule of thumb (empirically reliable for English text).
    """
    return max(1, len(text) // 4)


class DocumentChunker:
    """
    Splits documents into overlapping chunks with section preservation.

    Parameters:
      target_tokens: target max tokens per chunk (default 500 tokens ~2000 chars)
      overlap_tokens: token overlap between consecutive chunks (default 75 tokens)
      min_tokens: minimum tokens required for a valid chunk (avoids orphan fragments)
    """

    def __init__(
        self,
        target_tokens: int = 500,
        overlap_tokens: int = 75,
        min_tokens: int = 30,
    ) -> None:
        self.target_tokens = target_tokens
        self.overlap_tokens = overlap_tokens
        self.min_tokens = min_tokens
        self.target_chars = target_tokens * 4
        self.overlap_chars = overlap_tokens * 4

    def chunk_document(self, doc: ParsedDocument) -> list[ChunkData]:
        """
        Split a parsed document into structured chunks with metadata.

        Sections are processed individually so chunks do not span across
        unrelated 10-K sections (e.g. Risk Factors into Financial Statements).
        """
        sections = split_into_sections(doc.content_markdown)
        chunks: list[ChunkData] = []
        global_chunk_index = 0

        for section_title, section_text in sections:
            section_chunks = self._chunk_text(
                text=section_text,
                section_title=section_title,
                doc=doc,
                start_index=global_chunk_index,
            )
            chunks.extend(section_chunks)
            global_chunk_index += len(section_chunks)

        return chunks

    def _chunk_text(
        self,
        text: str,
        section_title: str,
        doc: ParsedDocument,
        start_index: int,
    ) -> list[ChunkData]:
        """Chunk a single section of text into overlapping windows."""
        if not text.strip():
            return []

        # Split section into paragraphs
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs:
            return []

        chunks: list[ChunkData] = []
        current_paragraphs: list[str] = []
        current_length = 0
        current_index = start_index

        for para in paragraphs:
            para_len = len(para)

            # If adding this paragraph exceeds target and we already have content:
            if current_length + para_len > self.target_chars and current_paragraphs:
                chunk_text = "\n\n".join(current_paragraphs)
                chunks.append(
                    self._create_chunk(
                        chunk_index=current_index,
                        chunk_text=chunk_text,
                        section_title=section_title,
                        doc=doc,
                    )
                )
                current_index += 1

                # Retain tail paragraphs for overlap
                overlap_paras: list[str] = []
                overlap_len = 0
                for p in reversed(current_paragraphs):
                    if overlap_len + len(p) <= self.overlap_chars:
                        overlap_paras.insert(0, p)
                        overlap_len += len(p)
                    else:
                        break

                current_paragraphs = overlap_paras
                current_length = overlap_len

            current_paragraphs.append(para)
            current_length += para_len

        # Final chunk in section
        if current_paragraphs:
            chunk_text = "\n\n".join(current_paragraphs)
            if estimate_token_count(chunk_text) >= self.min_tokens or not chunks:
                chunks.append(
                    self._create_chunk(
                        chunk_index=current_index,
                        chunk_text=chunk_text,
                        section_title=section_title,
                        doc=doc,
                    )
                )

        return chunks

    def _create_chunk(
        self,
        chunk_index: int,
        chunk_text: str,
        section_title: str,
        doc: ParsedDocument,
    ) -> ChunkData:
        """Construct ChunkData with full metadata envelope."""
        token_count = estimate_token_count(chunk_text)
        metadata = {
            "ticker": doc.ticker,
            "company_name": doc.company_name,
            "form_type": doc.form_type,
            "filing_date": doc.filing_date,
            "report_date": doc.report_date,
            "accession_number": doc.accession_number,
            "source_url": doc.source_url,
            "section": section_title,
            "chunk_index": chunk_index,
        }
        return ChunkData(
            chunk_index=chunk_index,
            chunk_text=chunk_text,
            token_count=token_count,
            section=section_title,
            chunk_metadata=metadata,
        )
