from __future__ import annotations

from typing import List
from uuid import UUID

from pydantic import BaseModel, Field

from .domain import BriefParams


class CreateSessionRequest(BaseModel):
    brief: str = Field(min_length=1, max_length=2000)
    num_clips: int = Field(ge=1, le=6)
    params: BriefParams


class TrackOut(BaseModel):
    id: UUID
    audio_url: str
    duration_sec: float


class ClusterOut(BaseModel):
    id: UUID
    label: str
    tracks: List[TrackOut]


class BatchOut(BaseModel):
    id: UUID
    clusters: List[ClusterOut]


class CreateSessionResponse(BaseModel):
    session_id: UUID
    batch: BatchOut


class MoreLikeRequest(BaseModel):
    num_clips: int = Field(ge=1, le=6)


class MoreLikeResponse(BaseModel):
    session_id: UUID
    parent_cluster_id: UUID
    batch: BatchOut
