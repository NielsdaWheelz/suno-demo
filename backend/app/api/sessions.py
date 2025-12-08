from __future__ import annotations

import wave
from pathlib import Path
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from backend.app.api.deps import get_session_service
from backend.app.models.api import (
    BatchOut,
    ClusterOut,
    CreateSessionRequest,
    CreateSessionResponse,
    MoreLikeRequest,
    MoreLikeResponse,
    TrackOut,
)
from backend.app.services.session_service import (
    GenerationFailedError,
    InvalidRequestError,
    NotFoundError,
    SessionService,
)

router = APIRouter()


def _read_duration_seconds(path: Path) -> float:
    try:
        with wave.open(str(path), "rb") as handle:
            frames = handle.getnframes()
            rate = handle.getframerate() or 1
            return frames / float(rate)
    except Exception:
        return 0.0


def _batch_to_out(batch, media_root: Path) -> BatchOut:
    clusters: List[ClusterOut] = []
    for cluster in batch.clusters:
        tracks: List[TrackOut] = []
        for track_id in cluster.track_ids:
            file_path = media_root / str(batch.session_id) / f"{track_id}.wav"
            tracks.append(
                TrackOut(
                    id=track_id,
                    audio_url=f"/media/{batch.session_id}/{track_id}.wav",
                    duration_sec=_read_duration_seconds(file_path),
                )
            )
        clusters.append(
            ClusterOut(
                id=cluster.id,
                label=cluster.label,
                tracks=tracks,
            )
        )
    return BatchOut(id=batch.id, clusters=clusters)


@router.post("/sessions", response_model=CreateSessionResponse)
def create_session_endpoint(
    body: CreateSessionRequest,
    service: SessionService = Depends(get_session_service),
):
    try:
        session = service.create_initial_batch(
            brief=body.brief, params=body.params, num_clips=body.num_clips
        )
    except InvalidRequestError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except GenerationFailedError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    batch = session.batches[-1]
    batch_out = _batch_to_out(batch, media_root=service.media_root)
    return CreateSessionResponse(session_id=session.id, batch=batch_out)


@router.post(
    "/sessions/{session_id}/clusters/{cluster_id}/more",
    response_model=MoreLikeResponse,
)
def more_like_endpoint(
    session_id: UUID,
    cluster_id: UUID,
    body: MoreLikeRequest,
    service: SessionService = Depends(get_session_service),
):
    try:
        batch = service.more_like_cluster(
            session_id=session_id, cluster_id=cluster_id, num_clips=body.num_clips
        )
    except InvalidRequestError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except GenerationFailedError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    batch_out = _batch_to_out(batch, media_root=service.media_root)
    return MoreLikeResponse(
        session_id=session_id, parent_cluster_id=cluster_id, batch=batch_out
    )
