import numpy as np

from backend.app.core.clustering import cluster_embeddings


def test_single_embedding_returns_single_cluster():
    embeddings = [np.array([0.0, 0.0])]

    clusters = cluster_embeddings(embeddings)

    assert clusters == [[0]]


def test_two_obvious_clusters_are_grouped():
    embeddings = [
        np.array([0.0, 0.0]),
        np.array([0.1, 0.0]),
        np.array([10.0, 10.0]),
        np.array([10.0, 10.1]),
    ]

    clusters = cluster_embeddings(embeddings, max_k=2)

    assert clusters == [[0, 1], [2, 3]]


def test_singleton_is_merged_into_nearest_large_cluster():
    embeddings = [
        np.array([0.0, 0.0]),
        np.array([0.2, 0.0]),
        np.array([5.0, 5.0]),
    ]

    clusters = cluster_embeddings(embeddings, max_k=2)

    assert clusters == [[0, 1, 2]]


def test_all_singletons_remain_unmerged():
    embeddings = [
        np.array([0.0, 0.0]),
        np.array([10.0, 0.0]),
        np.array([0.0, 10.0]),
    ]

    clusters = cluster_embeddings(embeddings)

    assert clusters == [[0], [1], [2]]


def test_clusters_are_sorted_by_size_then_index():
    embeddings = [
        np.array([0.0, 0.0]),
        np.array([0.1, 0.0]),
        np.array([0.0, 0.1]),
        np.array([5.0, 5.0]),
        np.array([5.1, 5.0]),
        np.array([10.0, 10.0]),
        np.array([10.1, 10.0]),
    ]

    clusters = cluster_embeddings(embeddings)

    assert clusters == [[0, 1, 2], [3, 4], [5, 6]]
