from typing import List

import numpy as np
from sklearn.cluster import KMeans


def cluster_embeddings(embeddings: List[np.ndarray], max_k: int = 3) -> List[List[int]]:
    """KMeans clustering with singleton-merge rule per spec."""
    n = len(embeddings)
    k0 = min(max_k, n)
    if k0 == 1:
        return [list(range(n))]

    X = np.stack(embeddings)
    kmeans = KMeans(n_clusters=k0, random_state=42, n_init=10, max_iter=300)
    labels = kmeans.fit_predict(X)

    clusters = {label: [] for label in range(k0)}
    for idx, label in enumerate(labels):
        clusters[label].append(idx)

    cluster_lists = list(clusters.values())
    has_large_cluster = any(len(members) >= 2 for members in cluster_lists)

    if has_large_cluster:
        large_labels = [label for label, members in clusters.items() if len(members) >= 2]
        large_centroids = {label: kmeans.cluster_centers_[label] for label in large_labels}

        for label, members in list(clusters.items()):
            if len(members) == 1:
                idx = members[0]
                embedding = embeddings[idx]
                target_label = min(
                    large_labels,
                    key=lambda l: float(np.linalg.norm(embedding - large_centroids[l])),
                )
                clusters[target_label].append(idx)
                clusters[label] = []

    merged_clusters = [sorted(members) for members in clusters.values() if members]
    merged_clusters.sort(key=lambda c: (-len(c), min(c)))
    return merged_clusters
