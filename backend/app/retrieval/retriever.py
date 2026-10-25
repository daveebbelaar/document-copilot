"""
Hybrid document retriever fusing vector search and full-text search with Reciprocal Rank Fusion.
"""
from __future__ import annotations

import structlog
from sqlalchemy.orm import Session

from app.config import settings
from app.ingest.embedder import EmbeddingGenerator
from app.retrieval.fusion import reciprocal_rank_fusion
from app.retrieval.queries import search_full_text_chunks, search_vector_chunks
from app.retrieval.schemas import RetrievalFilter, SourcePassage

logger = structlog.get_logger(__name__)


class DocumentRetriever:
    """
    Executes hybrid retrieval over SEC filing chunks:
      1. Dense vector search via pgvector (semantic similarity)
      2. Lexical search via Postgres full-text search (keyword exact match)
      3. Reciprocal Rank Fusion (RRF) to merge, deduplicate, and score
    """

    def __init__(
        self,
        db: Session,
        embedder: EmbeddingGenerator | None = None,
        rrf_k: int = 60,
        vector_weight: float = 1.0,
        fts_weight: float = 1.0,
    ) -> None:
        self.db = db
        self.embedder = embedder or EmbeddingGenerator()
        self.rrf_k = rrf_k
        self.vector_weight = vector_weight
        self.fts_weight = fts_weight

    def retrieve(
        self,
        query: str,
        limit: int | None = None,
        filters: RetrievalFilter | None = None,
    ) -> list[SourcePassage]:
        """
        Execute hybrid search and return ranked SourcePassage objects.

        Args:
          query: User search query or question
          limit: Maximum passages to return (defaults to settings.retrieval_max_chunks)
          filters: Optional metadata filters (ticker, form_type, section)
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        max_results = limit or settings.retrieval_max_chunks
        candidate_pool = max(20, max_results * 2)

        # 1. Vector embedding and semantic search
        query_vector = self.embedder.generate_embeddings([clean_query])[0]
        vector_candidates = search_vector_chunks(
            db=self.db,
            query_vector=query_vector,
            limit=candidate_pool,
            filters=filters,
        )

        # 2. Full-text search
        fts_candidates = search_full_text_chunks(
            db=self.db,
            query_text=clean_query,
            limit=candidate_pool,
            filters=filters,
        )

        logger.debug(
            "Retrieved candidate pools",
            vector_count=len(vector_candidates),
            fts_count=len(fts_candidates),
        )

        # 3. Reciprocal Rank Fusion
        fused_results = reciprocal_rank_fusion(
            ranked_lists=[vector_candidates, fts_candidates],
            k=self.rrf_k,
            key_fn=lambda pair: str(pair[0].id),
            weights=[self.vector_weight, self.fts_weight],
        )

        # 4. Map top candidates to SourcePassage schemas
        top_candidates = fused_results[:max_results]
        passages: list[SourcePassage] = []

        for (chunk, doc), score in top_candidates:
            section = chunk.chunk_metadata.get("section")
            passage = SourcePassage(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.chunk_text,
                score=round(score, 6),
                section=section,
                ticker=doc.ticker,
                company_name=doc.company_name,
                form_type=doc.form_type,
                filing_date=doc.filing_date,
                report_date=doc.report_date,
                source_url=doc.source_url,
                chunk_metadata=chunk.chunk_metadata,
            )
            passages.append(passage)

        return passages
