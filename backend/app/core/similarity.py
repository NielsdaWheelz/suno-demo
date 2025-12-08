from typing import List

import numpy as np


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity in [-1, 1]; returns 0.0 if either vector has zero norm."""
    norm_a = float(np.linalg.norm(a))
    norm_b = float(np.linalg.norm(b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def filter_by_similarity(
    embeddings: List[np.ndarray], centroid: np.ndarray, min_similarity: float, max_results: int
) -> List[int]:
    """Select indices by cosine threshold; fallback to top-N if none pass."""
    if not embeddings:
        return []

    scored = []
    for idx, emb in enumerate(embeddings):
        score = cosine_similarity(emb, centroid)
        scored.append((idx, score))

    scored.sort(key=lambda item: (-item[1], item[0]))

    accepted = [idx for idx, score in scored if score >= min_similarity]
    if accepted:
        return accepted[:max_results]

    top_indices = [idx for idx, _ in scored[: min(max_results, len(embeddings))]]
    return top_indices
