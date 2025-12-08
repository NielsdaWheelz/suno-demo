## 1. problem + solution
- problem: suno-like users generate clips blindly; they cannot see distribution, group outcomes, or iteratively steer toward desired regions.
- solution: backend for “Suno Session Lab” that ingests a brief + numeric params, generates a batch of short clips via text→audio, embeds + k-means clusters them, names clusters via LLM, and exposes endpoints to create an initial session/batch and request “more like this” for a cluster.

## 2. non-goals / v1 scope
- no auth or multi-user accounts.
- no section-level song control; no DAW/stems/timelines.
- no durable persistence; in-memory store is acceptable.
- no streaming; requests block until batch ready.
- no deployment/docker spec.

## 3. architecture overview
- single FastAPI service.
- layers:
  - `models`: Pydantic domain models (`Session`, `Batch`, `ClusterSummary`, `Track`, `BriefParams`).
  - `services`: `SessionStore` (in-memory), `SessionService` orchestrator, provider interfaces (`MusicProvider`, `EmbeddingProvider`, `ClusterNamingProvider`).
  - `core`: pure clustering/similarity helpers.
  - `api`: FastAPI routers exposing HTTP.
- external deps (real v1 targets, stubbed in tests):
  - HuggingFace Inference API `facebook/musicgen-small` for text→music.
  - local CLAP `laion/clap-htsat-unfused` via torch/torchaudio for embeddings.
  - small LLM (OpenAI or similar) for cluster naming.
- flow:
  - `HTTP → FastAPI → SessionService → (MusicProvider + EmbeddingProvider + ClusterNamingProvider + core.clustering) → SessionStore → HTTP response`

## 4. canonical pydantic models (domain + api)
Only these shapes go over HTTP; do not rename/add fields.

### 4.1 domain models (internal)
```python
from __future__ import annotations
from datetime import datetime
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
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ClusterSummary(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    batch_id: UUID
    label: str = Field(min_length=1, max_length=64)
    track_ids: List[UUID]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Batch(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    created_at: datetime = Field(default_factory=datetime.utcnow)
    prompt_text: str = Field(min_length=1)
    num_requested: int = Field(ge=1)
    num_generated: int = Field(ge=0)
    clusters: List[ClusterSummary] = Field(default_factory=list)

class Session(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    brief_text: str = Field(min_length=1)
    params: BriefParams
    batches: List[Batch] = Field(default_factory=list)
```
Note: embeddings/centroids are not stored on these models; they live in an internal map inside `SessionStore`.

### 4.2 api models (external)
```python
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
```

## 5. provider interfaces + GeneratedClip contract
Provide both fake (testing) and real implementations:
- fake modules: `fake_music_provider`, `fake_embedding_provider`, `fake_cluster_naming_provider`.
- real modules: `hf_musicgen_provider`, `clap_embedding_provider`, `openai_cluster_naming_provider`.

### 5.1 GeneratedClip
```python
from dataclasses import dataclass
from pathlib import Path

@dataclass
class GeneratedClip:
    audio_path: Path      # temp filesystem path; SessionService moves/renames into final layout
    duration_sec: float   # > 0
    raw_prompt: str       # exact prompt sent to music model
```

### 5.2 MusicProvider
```python
from typing import Protocol, List

class MusicProvider(Protocol):
    def generate_batch(
        self,
        prompt: str,
        num_clips: int,
        duration_sec: float,
    ) -> List[GeneratedClip]:
        """
        Generate up to num_clips audio clips.
        - num_clips: 1..settings.max_batch_size
        - duration_sec: target duration in seconds.
        Returns: list of 0..num_clips GeneratedClip.
        Skips individual failures; only raises if all generations fail.
        """
        ...
```
- file handling contract: MusicProvider writes clips to temporary paths under `media_root/tmp/` (or equivalent) and returns those paths; SessionService owns assigning track ids and moving files into `media_root/{session_id}/{track_id}.wav`, and sets `Track.audio_url` based on the final location.

### 5.3 EmbeddingProvider
```python
import numpy as np
from pathlib import Path

class EmbeddingProvider(Protocol):
    def embed_audio(self, audio_path: Path) -> np.ndarray:
        """
        Returns 1D float32 numpy array of fixed length D.
        Raises on I/O or model error.
        """
        ...

    def embed_text(self, text: str) -> np.ndarray:
        """
        Returns 1D float32 numpy array of length D.
        """
        ...
```
- note: `embed_text` is unused in v1; keep implementation trivial or unimplemented.

### 5.4 ClusterNamingProvider
```python
from typing import List

class ClusterNamingProvider(Protocol):
    def name_cluster(self, prompts: List[str]) -> str:
        """
        Given 1–N raw prompts for a cluster, return a short label:
        - 1–3 words
        - ASCII only
        - no quotes, no punctuation
        On LLM failure, callers will fallback to a generic 'cluster-<n>' label.
        """
        ...
```

## 6. clustering & similarity semantics
- `cluster_embeddings`:
  - input: `embeddings: list[np.ndarray]` (n ≥ 1, same dim), `max_k: int = 3`.
  - k0 = min(max_k, n).
  - if k0 == 1 → return `[list(range(n))]`.
  - else stack into X (n, d); run KMeans with n_clusters=k0, random_state=42, n_init=10, max_iter=300; group indices by label.
  - singleton merging: if >1 cluster and any large cluster (len ≥ 2), reassign each singleton to nearest large cluster by Euclidean distance to centroids; discard empty/singleton clusters. If all clusters are singletons, keep as-is.
  - sort clusters by size desc; ties by smallest index.
- centroids:
  - centroid = mean(embeddings[i] for i in cluster_indices).
  - store internally as `cluster_centroids[(session_id, cluster_id)] = centroid`; never exposed over HTTP.
- similarity:
  - `cosine_similarity(a, b)`: standard cosine in [-1, 1]; if either norm is zero, return 0.0.
  - `filter_by_similarity(embeddings, centroid, min_similarity, max_results)`:
    - if embeddings empty → [].
    - compute s_i = cos(embeddings[i], centroid); sort indices by s_i desc.
    - accepted = indices with s_i ≥ min_similarity.
    - if accepted non-empty: return accepted[:max_results]; else return top min(max_results, len(embeddings)) ignoring threshold.
- typical constants: `max_k = 3`; `min_similarity ≈ 0.3` (fixed constant in v1).

## 7. SessionStore + SessionService behavior
### 7.1 SessionStore (in-memory)
- maps: `session_id -> Session`; `(session_id, cluster_id) -> centroid (np.ndarray)`.
- methods:
  - `create_session(brief: str, params: BriefParams) -> Session`
  - `get_session(session_id: UUID) -> Session | None`
  - `add_batch(session_id: UUID, batch: Batch, centroids: dict[UUID, np.ndarray]) -> None`
  - `get_cluster(session_id: UUID, cluster_id: UUID) -> ClusterSummary | None`
  - `get_centroid(session_id: UUID, cluster_id: UUID) -> np.ndarray | None`
- semantics: no persistence; all data lost on restart; no concurrency guarantees beyond request scope.

### 7.2 SessionService
- prompt template (deterministic, reused everywhere):
  - `prompt = f"{brief} | energy={params.energy:.2f} | density={params.density:.2f} | duration={params.duration_sec:.1f}s"`
- `create_initial_batch(brief: str, params: BriefParams, num_clips: int) -> Session`
  - create Session via store.
  - call `MusicProvider.generate_batch(prompt, num_clips, params.duration_sec)`.
  - if zero clips returned → propagate/raise to yield 500.
  - for each clip, assign `track_id`, move file from provider temp path to `media_root/{session_id}/{track_id}.wav`, set `audio_url` accordingly.
  - embed each clip via `EmbeddingProvider.embed_audio`.
  - run `cluster_embeddings` on audio embeddings.
  - for each cluster:
    - choose up to 3 raw prompts from that cluster (order by track order).
    - call `ClusterNamingProvider.name_cluster`; on failure use `cluster-<index>` (index in sorted clusters starting at 1).
  - construct `Track`, `ClusterSummary`, `Batch`:
    - `Batch.num_requested = num_clips`, `num_generated = number of tracks actually stored (after any filtering)`, `prompt_text = prompt`.
    - `Track.cluster_id` matches its cluster’s `ClusterSummary.id`.
  - compute/store centroids in `SessionStore`.
  - attach batch to session in store; return Session.
- `more_like_cluster(session_id: UUID, cluster_id: UUID, num_clips: int) -> Batch`
  - fetch Session, ClusterSummary, centroid; 404 if any missing.
  - reuse base prompt template (same brief/params; no LLM steering).
  - call `MusicProvider.generate_batch(prompt, num_clips, params.duration_sec)`.
  - if zero clips → propagate/raise to yield 500.
  - embed new clips.
  - select indices via `filter_by_similarity(embeddings, centroid, min_similarity=0.3, max_results=num_clips)`.
  - construct new `Batch` with a single `ClusterSummary`:
    - new cluster id (do not reuse parent); label = parent label; `track_ids` = accepted track ids.
  - assign all accepted tracks to this new cluster id; discard non-accepted tracks (they are not stored); move accepted files to `media_root/{session_id}/{track_id}.wav` before persisting.
  - recompute centroid from accepted embeddings; store with new cluster id.
  - add batch to session in store; return Batch, with `Batch.num_generated = number of tracks actually stored (post-filter)`.

## 8. HTTP API endpoints
### 1) POST /sessions
- request: `CreateSessionRequest`
- response: `CreateSessionResponse`
- status: 200 success; 400 validation; 500 zero-generation or internal error.
- example success:
```json
{
  "session_id": "9e6b0c9a-3f7c-4b8f-8f2d-3c2f3cb5a111",
  "batch": {
    "id": "c7a8e1a2-0c33-4e5f-9f5a-9e1e1e5b9f22",
    "clusters": [
      {
        "id": "c1c1d2d3-e4f5-6789-abcd-ef0123456789",
        "label": "bright synthwave",
        "tracks": [
          {
            "id": "11111111-2222-3333-4444-555555555555",
            "audio_url": "/media/9e6b0c9a-3f7c-4b8f-8f2d-3c2f3cb5a111/11111111-2222-3333-4444-555555555555.wav",
            "duration_sec": 12.0
          }
        ]
      }
    ]
  }
}
```

### 2) POST /sessions/{session_id}/clusters/{cluster_id}/more
- path params: `session_id: UUID`, `cluster_id: UUID`
- request: `MoreLikeRequest`
- response: `MoreLikeResponse`
- status: 200 success; 404 session/cluster missing; 500 on internal error.
- example success:
```json
{
  "session_id": "9e6b0c9a-3f7c-4b8f-8f2d-3c2f3cb5a111",
  "parent_cluster_id": "c1c1d2d3-e4f5-6789-abcd-ef0123456789",
  "batch": {
    "id": "0f0e0d0c-0b0a-0908-0706-050403020100",
    "clusters": [
      {
        "id": "abcdabcd-abcd-abcd-abcd-abcdabcdabcd",
        "label": "bright synthwave",
        "tracks": [
          {
            "id": "aaaa1111-bbbb-2222-cccc-3333dddd4444",
            "audio_url": "/media/9e6b0c9a-3f7c-4b8f-8f2d-3c2f3cb5a111/aaaa1111-bbbb-2222-cccc-3333dddd4444.wav",
            "duration_sec": 12.0
          }
        ]
      }
    ]
  }
}
```

## 9. testing plan
- unit tests:
  - `cluster_embeddings` and `filter_by_similarity` using small synthetic vectors (cover singleton merge, similarity fallback).
  - `SessionStore` CRUD: create, add_batch, get_cluster, get_centroid.
  - `SessionService` with fake providers (no HF/CLAP/LLM), covering both main methods and zero-generation failure.
- integration tests:
  - FastAPI test client hitting `/sessions` and `/sessions/{session_id}/clusters/{cluster_id}/more` with fake providers injected via dependency overrides; assert response shapes match API models.
- real providers:
  - manual smoke tests only (external dependencies not in automated suite).

