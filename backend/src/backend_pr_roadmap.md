pr 0 – app skeleton, settings, media mount

goal: runnable fastapi app with settings + /health + static /media. no domain logic yet.

code:
	•	backend/src/suno_backend/app/main.py
	•	create FastAPI app.
	•	mount static files: /media → settings.media_root.
	•	include health router or inline GET /health → {"status": "ok"}.
	•	backend/src/suno_backend/app/settings.py
	•	Settings (pydantic BaseSettings) with at least:
	•	media_root: Path (default BASE_DIR / "media")
	•	max_batch_size: int (default 6)
	•	default_max_k: int (default 3)
	•	min_similarity: float (default 0.3)
	•	hf_api_url, hf_model_id, hf_api_token (optional)
	•	openai_api_key (optional)
	•	clap_model_name (default "laion/clap-htsat-unfused")
	•	get_settings() singleton.
	•	ensure media_root directory is created on startup.

tests (write first):
	•	tests/api/test_health.py
	•	app starts.
	•	GET /health returns 200 + {"status": "ok"}.
	•	tests/test_settings.py
	•	get_settings() returns same object on multiple calls.
	•	settings.media_root exists as a directory after app startup.

⸻

pr 1 – pydantic models (domain + api)

goal: define models per spec; no logic.

code:
	•	backend/src/suno_backend/app/models/domain.py
	•	BriefParams, Track, ClusterSummary, Batch, Session exactly as in spec.
	•	backend/src/suno_backend/app/models/api.py
	•	CreateSessionRequest, TrackOut, ClusterOut, BatchOut, CreateSessionResponse, MoreLikeRequest, MoreLikeResponse exactly as in spec.

tests:
	•	tests/models/test_domain_models.py
	•	can construct each model with minimal valid data.
	•	field constraints enforced (e.g. duration_sec > 0, brief non-empty).
	•	tests/models/test_api_models.py
	•	CreateSessionRequest rejects invalid num_clips (<1, >6).
	•	MoreLikeRequest same.

⸻

pr 2 – sessionstore (in-memory)

goal: in-memory store for sessions + centroids, no ml.

code:
	•	backend/src/suno_backend/app/services/session_store.py
	•	SessionStore with fields:
	•	_sessions: dict[UUID, Session]
	•	_centroids: dict[tuple[UUID, UUID], np.ndarray]  # (session_id, cluster_id)
	•	methods:

class SessionStore:
    def create_session(self, brief: str, params: BriefParams) -> Session: ...
    def get_session(self, session_id: UUID) -> Session | None: ...
    def add_batch(self, session_id: UUID, batch: Batch, centroids: dict[UUID, np.ndarray]) -> None: ...
    def get_cluster(self, session_id: UUID, cluster_id: UUID) -> ClusterSummary | None: ...
    def get_centroid(self, session_id: UUID, cluster_id: UUID) -> np.ndarray | None: ...


	•	add_batch expects centroids keyed by cluster_id; internally stores as (session_id, cluster_id).

tests:
	•	tests/services/test_session_store.py
	•	creating session stores it and can be fetched.
	•	add_batch attaches batch to session; num_batches increments.
	•	get_cluster returns correct cluster, None for missing.
	•	get_centroid returns correct centroid for known (session_id, cluster_id), None otherwise.

⸻

pr 3 – provider interfaces + fake providers

goal: define provider protocols + GeneratedClip, and fake implementations suitable for tests. no HF/CLAP/OpenAI yet.

code:
	•	backend/src/suno_backend/app/services/providers.py
	•	GeneratedClip dataclass.
	•	MusicProvider, EmbeddingProvider, ClusterNamingProvider protocols as in spec.
	•	doc clarifying:
	•	GeneratedClip.audio_path is a temp path under media_root/tmp, not final URL.
	•	EmbeddingProvider.embed_text must return same-dim vector as embed_audio, but is unused in v1.
	•	backend/src/suno_backend/app/services/fake_music_provider.py
	•	FakeMusicProvider(MusicProvider):
	•	writes small silent/constant wavs under media_root/tmp (e.g. tmp_{counter}.wav).
	•	returns GeneratedClip list length = num_clips.
	•	duration_sec is set to requested duration_sec (ok for fake).
	•	never fails unless explicitly told to (we’ll use a separate “failing” provider in tests).
	•	backend/src/suno_backend/app/services/fake_embedding_provider.py
	•	FakeEmbeddingProvider(EmbeddingProvider):
	•	embed_audio / embed_text return 1D numpy arrays of fixed length D (say 8), deterministic from input string (hash-based).
	•	backend/src/suno_backend/app/services/fake_cluster_naming_provider.py
	•	FakeClusterNamingProvider(ClusterNamingProvider):
	•	returns deterministic labels like "cluster-<index>", always 1–2 ASCII words, no punctuation.
	•	never raises.

tests:
	•	tests/services/test_fake_providers.py
	•	FakeMusicProvider.generate_batch creates num_clips files under media_root/tmp, with correct duration_sec.
	•	FakeEmbeddingProvider returns fixed-length vectors; same input → same output.
	•	FakeClusterNamingProvider returns 1–3 word ASCII labels; no quotes/punctuation.

⸻

pr 4 – core/clustering + similarity

goal: implement cluster_embeddings, cosine_similarity, filter_by_similarity per spec, with tests.

code:
	•	backend/src/suno_backend/app/core/clustering.py
	•	cluster_embeddings(embeddings: List[np.ndarray], max_k: int = 3) -> List[List[int]] with:
	•	k0 logic.
	•	k-means params: n_clusters=k0, random_state=42, n_init=10, max_iter=300.
	•	singleton merging rule.
	•	sorted clusters by size desc, then smallest index.
	•	backend/src/suno_backend/app/core/similarity.py
	•	cosine_similarity(a, b).
	•	filter_by_similarity(embeddings, centroid, min_similarity, max_results) exactly as in spec.

tests:
	•	tests/core/test_clustering.py
	•	happy path with two obvious clusters.
	•	n=1 → single cluster of [0].
	•	case where one cluster is singleton and gets merged into nearest large cluster.
	•	case where all clusters are singletons → no merge.
	•	cluster ordering rules.
	•	tests/core/test_similarity.py
	•	cosine_similarity:
	•	parallel vectors → 1.0
	•	opposite → -1.0
	•	zero vector → 0.0.
	•	filter_by_similarity:
	•	some above threshold → return indices sorted by similarity, truncated to max_results.
	•	none above threshold → fallback to top max_results.

⸻

pr 5 – sessionservice with fakes only

goal: implement orchestration in SessionService using fake providers + SessionStore + clustering/similarity. this is the core logic. no HF/CLAP/OpenAI yet.

code:
	•	backend/src/suno_backend/app/services/session_service.py
	•	SessionService.__init__ with injected store, music, embedder, namer, settings.
	•	render_prompt(brief, params) per spec.
	•	create_initial_batch(brief, params, num_clips):
	•	enforce 1 <= num_clips <= max_batch_size; if violated, raise a custom InvalidRequestError (or similar) that the API layer will map to 400.
	•	call store.create_session.
	•	build prompt.
	•	call music.generate_batch(prompt, num_clips, params.duration_sec).
	•	if 0 clips → raise GenerationFailedError (to map to 500).
	•	embed each clip via embedder.embed_audio.
	•	run cluster_embeddings.
	•	for each cluster:
	•	pick up to 3 prompts (from cluster’s clips).
	•	call namer.name_cluster; on exception, fallback to "cluster-<index>".
	•	compute centroid (mean).
	•	assign track_ids, cluster_ids, and final file locations:
	•	for each GeneratedClip:
	•	create Track.id.
	•	move file from temp → media_root/{session_id}/{track_id}.wav.
	•	set audio_url to /media/{session_id}/{track_id}.wav.
	•	num_generated = number of tracks stored (should equal #clips for initial batch).
	•	construct Batch, ClusterSummary objects; build centroids dict keyed by cluster_id.
	•	call store.add_batch. return updated Session.
	•	more_like_cluster(session_id, cluster_id, num_clips):
	•	enforce 1 <= num_clips <= max_batch_size; same error type.
	•	fetch session, cluster, centroid; if any missing → raise NotFoundError.
	•	rebuild prompt via render_prompt(session.brief_text, session.params).
	•	call music.generate_batch; 0 clips → GenerationFailedError.
	•	embed new clips.
	•	run filter_by_similarity with min_similarity=settings.min_similarity and max_results=num_clips.
	•	keep only accepted indices; num_generated = len(accepted).
	•	if num_generated == 0:
	•	you can either:
	•	treat as error (GenerationFailedError) or
	•	allow empty batch. decide and document; i’d lean allow empty batch for simplicity.
	•	assign Track objects only for accepted clips; move files like above; discard temp files for rejected clips.
	•	create new ClusterSummary:
	•	new cluster_id.
	•	label = parent cluster label.
	•	track_ids = accepted track ids.
	•	compute centroid for new cluster, store under (session_id, new_cluster_id).
	•	create Batch with num_requested=num_clips, num_generated=len(accepted), one cluster.
	•	store.add_batch. return Batch.

tests:
	•	tests/services/test_session_service_with_fakes.py
	•	happy path: create_initial_batch returns Session with one Batch; num_generated == num_requested; cluster count ≤ 3.
	•	enforcing num_clips > max_batch_size → raises InvalidRequestError.
	•	zero-generation: FakeMusicProvider variant that returns [] → raises GenerationFailedError.
	•	naming fallback: test-specific namer that raises once → label falls back to "cluster-1".
	•	more_like_cluster:
	•	creates a new batch with one cluster, new cluster_id, label == parent label.
	•	num_generated == number of accepted clips (from fake similarity).
	•	centroid stored for new cluster.

⸻

pr 6 – api layer + dependency wiring (fakes by default)

goal: expose /sessions and /sessions/{session_id}/clusters/{cluster_id}/more using SessionService. still only fakes wired in default app.

code:
	•	backend/src/suno_backend/app/api/deps.py
	•	functions to construct:
	•	global SessionStore instance.
	•	fakes for MusicProvider, EmbeddingProvider, ClusterNamingProvider.
	•	get_session_service() returning a shared SessionService.
	•	design so tests can override these via FastAPI’s dependency overrides.
	•	backend/src/suno_backend/app/api/sessions.py
	•	router with:
	•	POST /sessions:
	•	body: CreateSessionRequest.
	•	calls SessionService.create_initial_batch(...).
	•	maps domain errors:
	•	InvalidRequestError → 400
	•	GenerationFailedError → 500
	•	maps Session + first Batch into CreateSessionResponse.
	•	POST /sessions/{session_id}/clusters/{cluster_id}/more:
	•	body: MoreLikeRequest.
	•	path params as UUID.
	•	calls SessionService.more_like_cluster(...).
	•	NotFoundError → 404.
	•	other errors analogous.
	•	maps to MoreLikeResponse.
	•	backend/src/suno_backend/app/main.py
	•	include router.

tests:
	•	tests/api/test_sessions_api.py (with dependency overrides to fakes)
	•	POST /sessions with valid body → 200, body matches CreateSessionResponse.
	•	POST /sessions with num_clips > 6 → 400.
	•	POST /sessions/{session}/clusters/{cluster}/more valid → 200, matches MoreLikeResponse.
	•	missing session/cluster → 404.
	•	simulate zero-generation via a fake provider override → 500.

⸻

pr 7 – real hf musicgen provider

goal: implement HfMusicGenProvider and hook it into DI behind a config flag. tests use fakes; this is for manual smoke tests.

code:
	•	backend/src/suno_backend/app/services/hf_musicgen_provider.py
	•	HfMusicGenProvider(MusicProvider):
	•	uses settings.hf_api_url, settings.hf_model_id, settings.hf_api_token.
	•	sequentially calls HF inference num_clips times.
	•	for each response:
	•	writes audio bytes to media_root/tmp/{uuid}.wav.
	•	measures actual duration (using e.g. soundfile, wave, or torchaudio) to set duration_sec.
	•	collects GeneratedClips; if none succeed → raise GenerationFailedError.
	•	backend/src/suno_backend/app/api/deps.py
	•	add config switch:
	•	if settings.hf_api_token present and USE_FAKE_MUSIC_PROVIDER env not set, use HfMusicGenProvider.
	•	else use FakeMusicProvider.

tests:
	•	no network tests. maybe a tiny unit test that HfMusicGenProvider enforces num_clips <= max_batch_size and raises on impossible config using mocks.
	•	manual: run app locally with real HF creds, hit /sessions once, check media files + behavior.

⸻

pr 8 – real clap embedding provider

goal: implement ClapEmbeddingProvider with torch/torchaudio; wire via DI flag; manual smoke test only.

code:
	•	backend/src/suno_backend/app/services/clap_embedding_provider.py
	•	load ClapProcessor + ClapModel lazily or in module init.
	•	embed_audio:
	•	load wav via torchaudio.load.
	•	resample / normalize as required by CLAP.
	•	forward through model, get audio features, convert to numpy float32.
	•	embed_text:
	•	feed text through CLAP text encoder.
	•	return same-dim numpy vector.
	•	backend/src/suno_backend/app/api/deps.py
	•	if CLAP_ENABLED env flag is set, use ClapEmbeddingProvider; else use FakeEmbeddingProvider.

tests:
	•	maybe one tiny “dimensions match” test behind an xfail / skipped marker to avoid heavy deps in CI.
	•	manual: run app with CLAP enabled, ensure clustering still behaves.

⸻

pr 9 – real openai cluster naming provider

goal: implement LLM-based ClusterNamingProvider, wire via DI; manual tests only.

code:
	•	backend/src/suno_backend/app/services/openai_cluster_naming_provider.py
	•	OpenAiClusterNamingProvider(ClusterNamingProvider):
	•	constructor takes api_key.
	•	name_cluster(prompts: List[str]):
	•	pick up to 3 prompts, truncate each to ~100 chars.
	•	call small model (e.g. gpt-4o-mini) with strict system/user prompt:
	•	“produce 1–3 word ASCII label, no punctuation, no quotes”.
	•	post-process to enforce constraints.
	•	on failure → raise so SessionService can fallback to "cluster-<index>".
	•	backend/src/suno_backend/app/api/deps.py
	•	if settings.openai_api_key present and USE_FAKE_NAMER env not set, use OpenAiClusterNamingProvider; else fake.

tests:
	•	nothing networked. maybe a unit test with a mocked OpenAI client to check post-processing.