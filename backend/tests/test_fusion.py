"""
Unit tests for Reciprocal Rank Fusion (RRF) algorithm.
"""
from __future__ import annotations

import pytest

from app.retrieval.fusion import reciprocal_rank_fusion


def test_rrf_empty_input_returns_empty() -> None:
    """Empty ranked lists produce an empty result list."""
    assert reciprocal_rank_fusion([]) == []
    assert reciprocal_rank_fusion([[]]) == []


def test_rrf_single_list_preserves_order() -> None:
    """A single ranked list preserves item order with decreasing 1/(k+rank) scores."""
    items = ["doc_A", "doc_B", "doc_C"]
    fused = reciprocal_rank_fusion([items], k=60)

    assert len(fused) == 3
    assert [item for item, _ in fused] == items
    # Rank 1: 1/(60+1) = 1/61 ~ 0.01639
    # Rank 2: 1/(60+2) = 1/62 ~ 0.01613
    assert fused[0][1] == pytest.approx(1 / 61)
    assert fused[1][1] == pytest.approx(1 / 62)
    assert fused[2][1] == pytest.approx(1 / 63)


def test_rrf_boosts_overlapping_items() -> None:
    """An item appearing in both vector and FTS lists ranks above items in only one."""
    vector_results = ["doc_overlap", "doc_vector_only"]
    fts_results = ["doc_fts_only", "doc_overlap"]

    fused = reciprocal_rank_fusion([vector_results, fts_results], k=60)

    # doc_overlap score = 1/(60+1) + 1/(60+2)
    # doc_fts_only score = 1/(60+1)
    # doc_vector_only score = 1/(60+2)
    top_item, top_score = fused[0]
    assert top_item == "doc_overlap"
    expected_overlap_score = (1 / 61) + (1 / 62)
    assert top_score == pytest.approx(expected_overlap_score)


def test_rrf_respects_custom_weights() -> None:
    """Applying higher weight to one list scales its rank contributions."""
    list1 = ["doc_A"]
    list2 = ["doc_B"]

    # Weight list2 double list1
    fused = reciprocal_rank_fusion([list1, list2], k=60, weights=[1.0, 2.0])

    # doc_B: 2.0 / 61 = ~0.03278
    # doc_A: 1.0 / 61 = ~0.01639
    assert fused[0][0] == "doc_B"
    assert fused[1][0] == "doc_A"


def test_rrf_custom_key_function() -> None:
    """RRF correctly deduplicates complex objects using key_fn."""
    class MockDoc:
        def __init__(self, doc_id: str, title: str):
            self.doc_id = doc_id
            self.title = title

    list1 = [MockDoc("1", "Title A"), MockDoc("2", "Title B")]
    list2 = [MockDoc("1", "Title A Duplicate"), MockDoc("3", "Title C")]

    fused = reciprocal_rank_fusion(
        [list1, list2],
        k=60,
        key_fn=lambda doc: doc.doc_id,
    )

    assert len(fused) == 3
    assert fused[0][0].doc_id == "1"
