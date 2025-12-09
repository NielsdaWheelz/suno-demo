import numpy as np
import pytest

from suno_backend.app.core.similarity import cosine_similarity, filter_by_similarity


def test_cosine_similarity_parallel_vectors():
    a = np.array([1.0, 0.0])
    b = np.array([2.0, 0.0])

    assert cosine_similarity(a, b) == pytest.approx(1.0)


def test_cosine_similarity_opposite_vectors():
    a = np.array([1.0, 0.0])
    b = np.array([-1.0, 0.0])

    assert cosine_similarity(a, b) == pytest.approx(-1.0)


def test_cosine_similarity_zero_vector_returns_zero():
    a = np.array([0.0, 0.0])
    b = np.array([1.0, 0.0])

    assert cosine_similarity(a, b) == 0.0


def test_filter_by_similarity_returns_threshold_matches_sorted_and_truncated():
    embeddings = [
        np.array([1.0, 0.0]),
        np.array([0.6, 0.8]),
        np.array([0.0, 1.0]),
        np.array([0.5, 0.5]),
    ]
    centroid = np.array([1.0, 0.0])

    indices = filter_by_similarity(embeddings, centroid, min_similarity=0.5, max_results=2)

    assert indices == [0, 3]


def test_filter_by_similarity_fallbacks_when_none_meet_threshold():
    embeddings = [
        np.array([1.0, 0.0]),
        np.array([0.0, 1.0]),
        np.array([-1.0, 0.0]),
    ]
    centroid = np.array([0.6, 0.8])

    indices = filter_by_similarity(embeddings, centroid, min_similarity=0.9, max_results=2)

    assert indices == [1, 0]
