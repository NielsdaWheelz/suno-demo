## scope
- backend fastapi service for “suno session lab”: ingest brief + params, generate a batch of clips, embed + k-means cluster + name clusters, store session state in memory, and expose two blocking endpoints: `POST /sessions` (create session + initial batch) and `POST /sessions/{session_id}/clusters/{cluster_id}/more` (generate more like a cluster).

## module structure (under `backend/app/`)
- `main.py`: fastapi app factory, router registration, dependency wiring, settings init.
- `settings.py`: pydantic `Settings` (env-driven) for limits, media_root, provider keys/urls/model names.
- `models/domain.py`: pydantic domain models: `BriefParams`, `Track`, `ClusterSummary`, `Batch`, `Session`.
- `models/api.py`: api io models: `CreateSessionRequest`, `TrackOut`, `ClusterOut`, `BatchOut`, `CreateSessionResponse`, `MoreLikeRequest`, `MoreLikeResponse`.
- `core/clustering.py`: `cluster_embeddings`, centroid computation, singleton merge logic.
- `core/similarity.py`: `cosine_similarity`, `filter_by_similarity`.
- `services/session_store.py`: in-memory store for sessions and centroids.
- `services/session_service.py`: orchestration for initial batch and “more like” generation; file moves; prompt templating.
- `services/providers.py`: protocol definitions: `GeneratedClip`, `MusicProvider`, `EmbeddingProvider`, `ClusterNamingProvider`.
- `services/fake_music_provider.py`: fake batch generator returning temp wavs.
- `services/fake_embedding_provider.py`: fake embeddings generator.
- `services/fake_cluster_naming_provider.py`: fake naming stub.
- `services/hf_musicgen_provider.py`: HF Inference API client for `facebook/musicgen-small`.
- `services/clap_embedding_provider.py`: CLAP (`laion/clap-htsat-unfused`) audio embeddings via torch/torchaudio.
- `services/openai_cluster_naming_provider.py`: LLM-based cluster naming.
- `api/sessions.py`: fastapi router for both endpoints; dependency injection of service/providers.
- `api/deps.py`: provider/session service wiring, overridable for tests.
- `tests/core/test_clustering.py`, `tests/core/test_similarity.py`, `tests/services/test_session_store.py`, `tests/services/test_session_service_with_fakes.py`, `tests/api/test_sessions_api.py`: mapped tests.

## public signatures (types per spec; docstrings terse)
```python
# models/domain.py
class BriefParams(BaseModel):
    energy: float
    density: float
    duration_sec: float
    """Music control params: 0-1 energy/density, duration <=30s."""

class Track(BaseModel):
    id: UUID
    batch_id: UUID
    cluster_id: UUID
    audio_url: str
    duration_sec: float
    raw_prompt: str
    created_at: datetime
    """Stored track metadata; audio lives under media_root/session/track.wav."""

class ClusterSummary(BaseModel):
    id: UUID
    batch_id: UUID
    label: str
    track_ids: List[UUID]
    created_at: datetime
    """Cluster label + member track ids."""

class Batch(BaseModel):
    id: UUID
    session_id: UUID
    created_at: datetime
    prompt_text: str
    num_requested: int
    num_generated: int
    clusters: List[ClusterSummary]
    """Batch of generated clips with clustering results; num_generated counts stored tracks post-filter (not attempts)."""

class Session(BaseModel):
    id: UUID
    created_at: datetime
    brief_text: str
    params: BriefParams
    batches: List[Batch]
    """Session history and params; embeddings stored separately in store."""

# models/api.py
class CreateSessionRequest(BaseModel):
    brief: str
    num_clips: int
    params: BriefParams
    """Input brief + count + params."""

class TrackOut(BaseModel):
    id: UUID
    audio_url: str
    duration_sec: float
    """Track payload for clients."""

class ClusterOut(BaseModel):
    id: UUID
    label: str
    tracks: List[TrackOut]
    """Cluster payload with label and tracks."""

class BatchOut(BaseModel):
    id: UUID
    clusters: List[ClusterOut]
    """Batch payload returned over HTTP."""

class CreateSessionResponse(BaseModel):
    session_id: UUID
    batch: BatchOut
    """Session id + initial batch."""

class MoreLikeRequest(BaseModel):
    num_clips: int
    """Requested clip count for follow-up batch."""

class MoreLikeResponse(BaseModel):
    session_id: UUID
    parent_cluster_id: UUID
    batch: BatchOut
    """Follow-up batch tied to parent cluster."""

# services/providers.py
@dataclass
class GeneratedClip:
    audio_path: Path
    duration_sec: float
    raw_prompt: str
    """Temp clip output from music provider."""

class MusicProvider(Protocol):
    def generate_batch(self, prompt: str, num_clips: int, duration_sec: float) -> List[GeneratedClip]:
        """Generate up to num_clips clips; raise only if all fail."""

class EmbeddingProvider(Protocol):
    def embed_audio(self, audio_path: Path) -> np.ndarray:
        """Return 1D float32 embedding; raise on I/O/model error."""
    def embed_text(self, text: str) -> np.ndarray:
        """Return 1D float32 text embedding same dim as embed_audio; trivial/unused in v1."""

class ClusterNamingProvider(Protocol):
    def name_cluster(self, prompts: List[str]) -> str:
        """Return 1-3 word ASCII label; caller falls back on failure."""

# core/clustering.py
def cluster_embeddings(embeddings: List[np.ndarray], max_k: int = 3) -> List[List[int]]:
    """KMeans + singleton merge per spec; returns list of index clusters."""

# core/similarity.py
def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine in [-1,1]; zero if either norm is zero."""

def filter_by_similarity(embeddings: List[np.ndarray], centroid: np.ndarray, min_similarity: float, max_results: int) -> List[int]:
    """Select indices by cosine threshold; fallback to top-N when none pass."""

# services/session_store.py
class SessionStore:
    def create_session(self, brief: str, params: BriefParams) -> Session:
        """Create and store empty session."""
    def get_session(self, session_id: UUID) -> Session | None:
        """Fetch session or None."""
    def add_batch(self, session_id: UUID, batch: Batch, centroids: dict[UUID, np.ndarray]) -> None:
        """Attach batch and store centroids keyed by ClusterSummary.id combined with session_id."""
    def get_cluster(self, session_id: UUID, cluster_id: UUID) -> ClusterSummary | None:
        """Fetch cluster summary by ids."""
    def get_centroid(self, session_id: UUID, cluster_id: UUID) -> np.ndarray | None:
        """Fetch stored centroid or None."""

# services/session_service.py
class SessionService:
    def __init__(self, store: SessionStore, music: MusicProvider, embedder: EmbeddingProvider, namer: ClusterNamingProvider, media_root: Path, max_batch_size: int, default_max_k: int, min_similarity: float):
        """Compose providers, store, and constants."""
    def create_initial_batch(self, brief: str, params: BriefParams, num_clips: int) -> Session:
        """Validate num_clips <= max_batch_size (else 400), create session, generate batch, cluster/name tracks, persist, return session; num_generated = stored clips."""
    def more_like_cluster(self, session_id: UUID, cluster_id: UUID, num_clips: int) -> Batch:
        """Validate num_clips <= max_batch_size (else 400), generate tracks near centroid, filter, persist new batch with inherited label; creates new ClusterSummary id (parent unchanged); num_generated = accepted clips."""
    @staticmethod
    def render_prompt(brief: str, params: BriefParams) -> str:
        """Deterministic prompt: f\"{brief} | energy={params.energy:.2f} | density={params.density:.2f} | duration={params.duration_sec:.1f}s\"."""
```

SessionService semantics:
- num_generated: initial batch = number of clips successfully returned and stored; more_like_cluster = number of accepted clips after similarity filtering (discarded/rejected not counted).
- cluster ids: more_like_cluster creates a new ClusterSummary id; parent cluster remains unchanged; label is copied from parent.
- max_batch_size: enforced in SessionService for both methods; violations surface as domain errors mapped to HTTP 400; MusicProvider assumes num_clips already validated.

## provider implementations (behavior-level)
- `FakeMusicProvider` → `MusicProvider`; deps: stdlib/tempfile/wave or numpy noise; returns deterministic/synthetic wavs under `media_root/tmp`; uses input prompt, duration, count; skips failures by returning fewer clips; raises only if none produced.
- `FakeEmbeddingProvider` → `EmbeddingProvider`; deps: numpy; returns fixed-length deterministic vectors (e.g., seeded on path text); `embed_text` stub matching audio dimension.
- `FakeClusterNamingProvider` → `ClusterNamingProvider`; deps: none; returns deterministic 1–3 word ASCII label obeying real constraints; never raises.
- `HfMusicGenProvider` → `MusicProvider`; deps: `requests` to HF Inference API `facebook/musicgen-small`; posts prompt/duration; streams/writes wav to temp; duration_sec measured from returned audio (not requested target); skips failed clips; raises if all fail.
- `ClapEmbeddingProvider` → `EmbeddingProvider`; deps: `torch`, `torchaudio`, `laion/clap-htsat-unfused`; loads model once; `embed_audio` loads wav, normalizes, forwards to model, returns numpy float32 vector; `embed_text` optional passthrough.
- `OpenAiClusterNamingProvider` → `ClusterNamingProvider`; deps: OpenAI client; prompts LLM with up to 3 raw prompts; enforces ASCII, strip punctuation/quotes; on api error, propagate to caller (service handles fallback).

## constants & configuration
- constants: `DEFAULT_MAX_K = 3`; `MIN_SIMILARITY = 0.3`; `MAX_BATCH_SIZE` from settings (<=6 per API constraint); `KMEANS_RANDOM_STATE = 42`; `KMEANS_N_INIT = 10`; `KMEANS_MAX_ITER = 300`; prompt template fixed.
- `Settings` (pydantic BaseSettings) fields: `media_root: Path`; `max_batch_size: int`; `default_max_k: int`; `min_similarity: float`; `hf_api_url/model`; `hf_api_token`; `openai_api_key`; `clap_model_name`; optional `log_level`.
- loading: env vars with sensible defaults for local dev; secrets required for real providers; fakes ignore keys.
- hard-coded in v1: prompt template; k-means params; `MIN_SIMILARITY=0.3` unless overridden by settings; ASCII-only cluster labels enforced in provider/service; max public num_clips constrained by both API validation (1..6) and `max_batch_size` guard in service; SessionService is authority for `max_batch_size` and returns 400 on violation; MusicProvider may assume num_clips already validated.
- media handling: providers write to `media_root/tmp`; service ensures `media_root/{session_id}/` exists, moves/renames to `{track_id}.wav`, sets `audio_url` to `/media/{session_id}/{track_id}.wav`. Clarification: media_root must be writable; behavior undefined if not—treat as 500.

## test plan mapped to files
- `tests/core/test_clustering.py`: cluster_embeddings happy path; singleton merge; all-singletons case; k cap.
- `tests/core/test_similarity.py`: cosine edge cases (zero norm); filter_by_similarity threshold hit/miss fallback; ordering and max_results.
- `tests/services/test_session_store.py`: create_session; add_batch persists batches/centroids; get_cluster/centroid return None on missing.
- `tests/services/test_session_service_with_fakes.py`: create_initial_batch success; zero-generation raises; cluster naming fallback (include flaky fake that raises once); more_like_cluster filters by similarity, inherits label, discards rejected, stores centroid.
- `tests/api/test_sessions_api.py`: POST /sessions and /sessions/{session_id}/clusters/{cluster_id}/more with dependency overrides to fakes; status codes; response shape matches api models; 404 for missing session/cluster; 500 on zero-generation.

## gaps / clarifications (minimal)
- media_root location and URL mounting not specified; assume filesystem path provided via settings and `/media` static mount configured in `main.py`.
- embed_text unused; may return zeros or reuse audio model output; must not break interface and must match audio embedding dimensionality.
- concurrency and cleanup of tmp files are unspecified; minimal approach: service deletes/moves only accepted files; tests use temp dirs.
