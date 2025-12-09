## suno session lab — backend

backend-only notes. frontend docs live in `frontend/README.md`.

### what this service does
- fastapi app that takes a text brief + control params, generates short music clips, embeds + clusters them, and serves static wavs from disk.
- state is in-memory only (session store + centroids); restart wipes sessions.
- media is written under `media/{session_id}/{track_id}.wav` and mounted at `/media/*`.
- two blocking endpoints: create session (`POST /sessions`) and generate “more like this cluster” (`POST /sessions/{session_id}/clusters/{cluster_id}/more`). plus `/health`.

### core flow (suno_backend/app)
- `main.py` wires fastapi, mounts `/media`, includes the sessions router, and logs settings.
- `api/sessions.py` maps http to `SessionService`; translates domain errors to 400/404/500.
- `models/domain.py` holds session/batch/cluster/track models; `models/api.py` shapes io payloads.
- `core/clustering.py` runs k-means with singleton-merge rules; `core/similarity.py` handles cosine + filtering.
- `services/session_service.py` orchestrates generation, embedding, clustering, labeling, file moves.
- `services/session_store.py` is an in-memory store for sessions + centroids; no persistence.
- `services/providers.py` defines `MusicProvider`, `EmbeddingProvider`, `ClusterNamingProvider`.
- provider impls: fake music/embedding/namer; optional ElevenLabs music; optional OpenAI cluster naming; optional CLAP embeddings.

### api surface (simplified)
- `POST /sessions` — body: `{"brief": str, "num_clips": int (1-6), "params": {"energy": 0-1, "density": 0-1, "duration_sec": >0 to 10}}`. returns `{session_id, batch:{id, clusters:[{id, label, tracks:[{id, audio_url, duration_sec}]}]}}`.
- `POST /sessions/{session_id}/clusters/{cluster_id}/more` — body: `{"num_clips": int}`; returns `{session_id, parent_cluster_id, batch}`. label is inherited; tracks filtered by similarity threshold.
- `GET /health` — `{status:"ok"}`.

### configuration (env-driven; prefix `SUNO_LAB_`)
- `MEDIA_ROOT` (Path) default `backend/media`.
- `MAX_BATCH_SIZE` default `6` (service rejects > max).
- `DEFAULT_MAX_K` default `3` (k-means cap).
- `MIN_SIMILARITY` default `0.3` (filter threshold for “more like”).
- `MUSIC_PROVIDER` default `fake`; choices: `fake`, `elevenlabs`.
- `ELEVENLABS_API_KEY` (or `xi_api_key`) and `ELEVENLABS_OUTPUT_FORMAT` (default `pcm_44100`) when using ElevenLabs.
- `CLAP_ENABLED` default `false`; `CLAP_MODEL_NAME` default `laion/clap-htsat-unfused`.
- `OPENAI_API_KEY` optional; used when `use_fake_namer` is false. `USE_FAKE_NAMER` default `false`.
- legacy aliases (`MUSIC_PROVIDER`, `ELEVENLABS_API_KEY`, etc.) are accepted via `AliasChoices`.

### providers and behavior
- fake stack (defaults): `FakeMusicProvider` writes silent wavs to `media/tmp`; `FakeEmbeddingProvider` hashes path/text into deterministic vectors; `FakeClusterNamingProvider` deterministic 1–3 word labels.
- `ElevenLabsMusicProvider`: hits `https://api.elevenlabs.io/v1/music/detailed`, writes wavs, trims >10s, raises if all clips fail.
- `ClapEmbeddingProvider`: loads `laion/clap-htsat-unfused` once via transformers/torch/torchaudio; expects 16-bit PCM wavs; rescales to 48 kHz mono internally.
- `OpenAiClusterNamingProvider`: calls chat completions (`gpt-4o-mini`), enforces ASCII 1–3 words; service falls back to `cluster-{i}` on failure.

### running locally
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
uv pip install -e ".[dev]"  # or pip install -e ".[dev]"
# set env as needed in backend/.env, e.g.:
export SUNO_LAB_MUSIC_PROVIDER=fake  # default
uvicorn suno_backend.app.main:app --app-dir src --reload
```
server listens on `http://127.0.0.1:8000`; media served from `/media/...`.

### quick curl smoke test (fakes)
```bash
curl -s -X POST http://127.0.0.1:8000/sessions \
  -H "content-type: application/json" \
  -d '{"brief":"warm pads","num_clips":2,"params":{"energy":0.6,"density":0.4,"duration_sec":5}}'
```
response contains `session_id`, `batch.id`, cluster/track ids, and `audio_url` paths (served locally).

### tests
- python >=3.12; install dev deps via `pip install -e ".[dev]"`.
- run `pytest` (uses fake providers and temp media dirs; no network).

### operational notes
- state is per-process; horizontal scaling needs shared store + media.
- `/media` directory must be writable; failures surface as 500s.
- CLAP and torch bring heavy deps; leave `CLAP_ENABLED=false` unless you need real embeddings.
