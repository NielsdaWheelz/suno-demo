from __future__ import annotations

from typing import Dict, Tuple
from uuid import UUID

import numpy as np

from suno_backend.app.models.domain import Batch, BriefParams, ClusterSummary, Session


class SessionStore:
    def __init__(self) -> None:
        self._sessions: Dict[UUID, Session] = {}
        self._centroids: Dict[Tuple[UUID, UUID], np.ndarray] = {}

    def create_session(self, brief: str, params: BriefParams) -> Session:
        """Create and store empty session."""
        session = Session(brief_text=brief, params=params, batches=[])
        self._sessions[session.id] = session
        return session

    def get_session(self, session_id: UUID) -> Session | None:
        """Fetch session or None."""
        return self._sessions.get(session_id)

    def add_batch(self, session_id: UUID, batch: Batch, centroids: Dict[UUID, np.ndarray]) -> None:
        """Attach batch and store centroids."""
        session = self._sessions.get(session_id)
        if session is None:
            raise ValueError("session not found")
        if batch.session_id != session_id:
            raise ValueError("batch session_id mismatch")

        cluster_ids_from_batch = {cluster.id for cluster in batch.clusters}
        centroid_keys = set(centroids.keys())

        extra_centroids = centroid_keys - cluster_ids_from_batch
        if extra_centroids:
            raise ValueError("extra centroids provided")

        missing_centroids = cluster_ids_from_batch - centroid_keys
        if missing_centroids:
            raise ValueError("missing centroids for clusters")

        session.batches.append(batch)
        for cluster_id, centroid in centroids.items():
            self._centroids[(session_id, cluster_id)] = centroid

    def get_cluster(self, session_id: UUID, cluster_id: UUID) -> ClusterSummary | None:
        """Fetch cluster summary by ids."""
        session = self._sessions.get(session_id)
        if session is None:
            return None
        for batch in session.batches:
            for cluster in batch.clusters:
                if cluster.id == cluster_id:
                    return cluster
        return None

    def get_centroid(self, session_id: UUID, cluster_id: UUID) -> np.ndarray | None:
        """Fetch stored centroid or None."""
        return self._centroids.get((session_id, cluster_id))
