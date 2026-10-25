"""
Reciprocal Rank Fusion (RRF) for merging and re-ranking disparate search result lists.
"""
from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable


def reciprocal_rank_fusion[T](
    ranked_lists: list[list[T]],
    k: int = 60,
    key_fn: Callable[[T], str] | None = None,
    weights: list[float] | None = None,
) -> list[tuple[T, float]]:
    """
    Combine multiple ranked lists into a single ranked list using Reciprocal Rank Fusion.

    Formula:
      RRF_score(d) = sum(weight_i / (k + rank_i(d)))

    Args:
      ranked_lists: list of ranked result lists (e.g. [vector_results, fts_results]).
      k: smoothing constant (standard default is 60).
      key_fn: function extracting unique identity from an item (default is identity / str(item)).
      weights: optional list of float weights per ranked list (default 1.0 each).

    Returns:
      List of (item, rrf_score) tuples sorted in descending order of score.
    """
    if not ranked_lists:
        return []

    if key_fn is None:
        key_fn = lambda x: str(x)  # noqa: E731

    if weights is None:
        weights = [1.0] * len(ranked_lists)
    elif len(weights) != len(ranked_lists):
        raise ValueError("Length of weights must match length of ranked_lists")

    scores: dict[str, float] = defaultdict(float)
    items: dict[str, T] = {}

    for list_idx, ranked_list in enumerate(ranked_lists):
        weight = weights[list_idx]
        for rank, item in enumerate(ranked_list, start=1):
            key = key_fn(item)
            if key not in items:
                items[key] = item
            # 1-based rank: rank 1 gives weight / (k + 1)
            scores[key] += weight / (k + rank)

    # Sort descending by score
    sorted_items = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)
    return [(items[key], score) for key, score in sorted_items]
