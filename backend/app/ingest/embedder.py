"""
Batch embedding generator using OpenAI SDK compatible client (OpenRouter or OpenAI).
"""
from __future__ import annotations

import time

import structlog
from openai import OpenAI

from app.config import settings

logger = structlog.get_logger(__name__)


class EmbeddingGenerator:
    """
    Generates dense vector embeddings in batches with retry and dimension verification.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        expected_dimensions: int | None = None,
        batch_size: int = 32,
    ) -> None:
        self.api_key = api_key or settings.openai_api_key
        self.base_url = base_url or settings.openai_base_url
        self.model = model or settings.openai_embedding_model
        self.expected_dimensions = (
            expected_dimensions or settings.openai_embedding_dimensions
        )
        self.batch_size = batch_size
        self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self.total_tokens_used = 0

    def generate_embeddings(
        self,
        texts: list[str],
        max_retries: int = 3,
    ) -> list[list[float]]:
        """
        Generate embeddings for a list of texts in batches.

        Returns:
          list of embedding vectors, preserving input text order.
        """
        if not texts:
            return []

        all_embeddings: list[list[float]] = []

        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            batch_embeddings = self._embed_batch_with_retry(
                batch=batch,
                max_retries=max_retries,
                batch_index=i // self.batch_size + 1,
                total_batches=(len(texts) + self.batch_size - 1) // self.batch_size,
            )
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    def _embed_batch_with_retry(
        self,
        batch: list[str],
        max_retries: int,
        batch_index: int,
        total_batches: int,
    ) -> list[list[float]]:
        """Embed a single batch with exponential backoff on transient errors."""
        # Clean / strip any empty or pure whitespace strings
        sanitized_batch = [t if t.strip() else " " for t in batch]

        last_error: Exception | None = None
        for attempt in range(1, max_retries + 1):
            try:
                response = self._client.embeddings.create(
                    input=sanitized_batch,
                    model=self.model,
                )

                if response.usage and hasattr(response.usage, "total_tokens"):
                    self.total_tokens_used += response.usage.total_tokens or 0

                embeddings = [item.embedding for item in response.data]

                # Verify dimensions
                if embeddings and len(embeddings[0]) != self.expected_dimensions:
                    msg = (
                        f"Embedding dimension mismatch: expected {self.expected_dimensions}, "
                        f"got {len(embeddings[0])} from model {self.model}"
                    )
                    raise ValueError(msg)

                return embeddings

            except Exception as e:
                last_error = e
                logger.warning(
                    "Embedding batch failed, retrying",
                    attempt=attempt,
                    batch=f"{batch_index}/{total_batches}",
                    error=str(e),
                )
                if attempt < max_retries:
                    time.sleep(2**attempt)

        raise RuntimeError(
            f"Failed to generate embeddings for batch {batch_index}/{total_batches} "
            f"after {max_retries} attempts: {last_error}"
        ) from last_error
