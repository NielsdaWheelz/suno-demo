from __future__ import annotations

from datetime import UTC, datetime
from typing import List
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class BriefParams(BaseModel):
    energy: float = Field(ge=0.0, le=1.0)
    density: float = Field(ge=0.0, le=1.0)
    duration_sec: float = Field(gt=0.0, le=30.0)


class Track(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    batch_id: UUID
    cluster_id: UUID
    audio_url: str  # "/media/{session_id}/{track_id}.wav"
    duration_sec: float = Field(gt=0.0, le=30.0)
    raw_prompt: str = Field(min_length=1)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ClusterSummary(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    batch_id: UUID
    label: str = Field(min_length=1, max_length=64)
    track_ids: List[UUID]
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Batch(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    prompt_text: str = Field(min_length=1)
    num_requested: int = Field(ge=1)
    num_generated: int = Field(ge=0)
    clusters: List[ClusterSummary] = Field(default_factory=list)


class Session(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    brief_text: str = Field(min_length=1)
    params: BriefParams
    batches: List[Batch] = Field(default_factory=list)
