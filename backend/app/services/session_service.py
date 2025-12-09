from __future__ import annotations

from pathlib import Path
from typing import Dict, List
from uuid import UUID, uuid4

import numpy as np
import logging

from backend.app.core.clustering import cluster_embeddings
from backend.app.core.similarity import filter_by_similarity
from backend.app.models.domain import Batch, BriefParams, ClusterSummary, Session, Track
from backend.app.services.providers import (
    ClusterNamingProvider,
    EmbeddingProvider,
    GeneratedClip,
    MusicProvider,
)
from backend.app.services.session_store import SessionStore


logger = logging.getLogger(__name__)


class InvalidRequestError(Exception):
    ...


class NotFoundError(Exception):
    ...


class GenerationFailedError(Exception):
    ...


class SessionService:
    def __init__(
        self,
        store: SessionStore,
        music: MusicProvider,
        embedder: EmbeddingProvider,
        namer: ClusterNamingProvider,
        media_root: Path,
        max_batch_size: int,
        default_max_k: int,
        min_similarity: float,
    ) -> None:
        self.store = store
        self.music = music
        self.embedder = embedder
        self.namer = namer
        self.media_root = media_root
        self.max_batch_size = max_batch_size
        self.default_max_k = default_max_k
        self.min_similarity = min_similarity
        logger.info(
            "SessionService initialized music=%s embedder=%s namer=%s media_root=%s max_batch_size=%s default_max_k=%s min_similarity=%.2f",
            type(music).__name__,
            type(embedder).__name__,
            type(namer).__name__,
            media_root,
            max_batch_size,
            default_max_k,
            min_similarity,
        )

    @staticmethod
    def render_prompt(brief: str, params: BriefParams) -> str:
        return f"{brief} | energy={params.energy:.2f} | density={params.density:.2f} | duration={params.duration_sec:.1f}s"

    def create_initial_batch(
        self,
        brief: str,
        params: BriefParams,
        num_clips: int,
    ) -> Session:
        self._validate_num_clips(num_clips)

        session = self.store.create_session(brief, params)
        prompt_text = self.render_prompt(brief, params)
        logger.info(
            "create_initial_batch session_id=%s prompt=%s num_clips=%s",
            session.id,
            prompt_text,
            num_clips,
        )
        clips = self.music.generate_batch(prompt_text, num_clips, params.duration_sec)
        if len(clips) == 0:
            raise GenerationFailedError("no clips generated")

        batch_id = uuid4()
        track_infos = self._prepare_track_infos(clips)
        embeddings = [info["embedding"] for info in track_infos]

        cluster_assignments = cluster_embeddings(embeddings, max_k=self.default_max_k)
        clusters: List[ClusterSummary] = []
        centroids: Dict[UUID, np.ndarray] = {}

        for cluster_index, member_indices in enumerate(cluster_assignments, start=1):
            cluster_id = uuid4()
            prompts_for_label = [
                track_infos[i]["clip"].raw_prompt for i in member_indices[:3]
            ]
            try:
                label = self.namer.name_cluster(prompts_for_label)
            except Exception:
                label = f"cluster-{cluster_index}"

            centroid = np.mean([embeddings[i] for i in member_indices], axis=0)
            centroids[cluster_id] = centroid

            for i in member_indices:
                track_infos[i]["cluster_id"] = cluster_id

            clusters.append(
                ClusterSummary(
                    id=cluster_id,
                    batch_id=batch_id,
                    label=label,
                    track_ids=[track_infos[i]["track_id"] for i in member_indices],
                )
            )

        tracks = self._finalize_tracks(
            session_id=session.id,
            batch_id=batch_id,
            track_infos=track_infos,
        )
        logger.info(
            "initial batch created session_id=%s batch_id=%s num_tracks=%s num_clusters=%s",
            session.id,
            batch_id,
            len(tracks),
            len(clusters),
        )

        batch = Batch(
            id=batch_id,
            session_id=session.id,
            prompt_text=prompt_text,
            num_requested=num_clips,
            num_generated=len(tracks),
            clusters=clusters,
        )

        self.store.add_batch(session.id, batch, centroids)
        return session

    def more_like_cluster(
        self,
        session_id: UUID,
        cluster_id: UUID,
        num_clips: int,
    ) -> Batch:
        self._validate_num_clips(num_clips)

        session = self.store.get_session(session_id)
        if session is None:
            raise NotFoundError("session not found")

        parent_cluster = self.store.get_cluster(session_id, cluster_id)
        if parent_cluster is None:
            raise NotFoundError("cluster not found")

        centroid = self.store.get_centroid(session_id, cluster_id)
        if centroid is None:
            raise NotFoundError("centroid not found")

        prompt_text = self.render_prompt(session.brief_text, session.params)
        clips = self.music.generate_batch(prompt_text, num_clips, session.params.duration_sec)
        if len(clips) == 0:
            raise GenerationFailedError("no clips generated")

        batch_id = uuid4()
        track_infos = self._prepare_track_infos(clips)
        embeddings = [info["embedding"] for info in track_infos]

        accepted_indices = filter_by_similarity(
            embeddings, centroid, min_similarity=self.min_similarity, max_results=num_clips
        )
        accepted_set = set(accepted_indices)
        for idx, info in enumerate(track_infos):
            if idx not in accepted_set:
                try:
                    info["clip"].audio_path.unlink(missing_ok=True)
                except Exception:
                    pass

        accepted_tracks = [track_infos[idx] for idx in accepted_indices]
        new_cluster_id = uuid4()
        track_ids: List[UUID] = []
        for info in accepted_tracks:
            info["cluster_id"] = new_cluster_id
            track_ids.append(info["track_id"])

        centroid_new = np.mean([info["embedding"] for info in accepted_tracks], axis=0)
        centroids = {new_cluster_id: centroid_new}

        self._finalize_tracks(
            session_id=session.id,
            batch_id=batch_id,
            track_infos=accepted_tracks,
        )

        cluster_summary = ClusterSummary(
            id=new_cluster_id,
            batch_id=batch_id,
            label=parent_cluster.label,
            track_ids=track_ids,
        )

        batch = Batch(
            id=batch_id,
            session_id=session.id,
            prompt_text=prompt_text,
            num_requested=num_clips,
            num_generated=len(track_ids),
            clusters=[cluster_summary],
        )

        self.store.add_batch(session.id, batch, centroids)
        return batch

    def _validate_num_clips(self, num_clips: int) -> None:
        if num_clips < 1 or num_clips > self.max_batch_size:
            raise InvalidRequestError("invalid num_clips")

    def _prepare_track_infos(self, clips: List[GeneratedClip]) -> List[Dict[str, object]]:
        track_infos: List[Dict[str, object]] = []
        for clip in clips:
            embedding = self.embedder.embed_audio(clip.audio_path)
            track_infos.append(
                {
                    "clip": clip,
                    "embedding": embedding,
                    "track_id": uuid4(),
                }
            )
        return track_infos

    def _finalize_tracks(
        self,
        session_id: UUID,
        batch_id: UUID,
        track_infos: List[Dict[str, object]],
    ) -> List[Track]:
        final_dir = self.media_root / str(session_id)
        final_dir.mkdir(parents=True, exist_ok=True)

        tracks: List[Track] = []
        for info in track_infos:
            cluster_id = info.get("cluster_id")
            if cluster_id is None:
                continue
            track_id: UUID = info["track_id"]
            clip: GeneratedClip = info["clip"]  # type: ignore[assignment]
            final_path = final_dir / f"{track_id}.wav"
            clip.audio_path.rename(final_path)
            track = Track(
                id=track_id,
                batch_id=batch_id,
                cluster_id=cluster_id,
                audio_url=f"/media/{session_id}/{track_id}.wav",
                duration_sec=clip.duration_sec,
                raw_prompt=clip.raw_prompt,
            )
            tracks.append(track)

        return tracks
