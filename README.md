## suno session lab

demo that pairs a fastapi backend (music clip generation + clustering) with a react/tailwind frontend for **node-based branching** (“more like this” from any result) plus a single bottom player with an audio visualizer. this doc is the repo entry point for both juniors onboarding and a skeptical cto skimming the demo.

### repo layout
- `backend/` — fastapi app, providers, tests. see `backend/README.md` for deep backend details.
- `frontend/` — react 19 + vite + tailwind ui. see `frontend/README.md` for ui specifics.
- media files land under `backend/media/` by default and are served at `/media/*`.

### fastest local demo (fake providers; no keys required)
```bash
# 1) backend
cd backend
python -m venv .venv && source .venv/bin/activate
uv pip install -e ".[dev]"  # or pip install -e ".[dev]"
cp .env.example .env  # optional; defaults are fine for fakes
uvicorn suno_backend.app.main:app --app-dir src --reload

# 2) frontend (new terminal)
cd frontend
npm install
VITE_API_BASE=http://127.0.0.1:8000 npm run dev
# open http://127.0.0.1:5173
```
- happy path: enter a brief, tweak sliders (energy, density, duration, tempo, brightness), optional “instrumental only”, generate (UI uses 3 clips per generation); click “more like this” on any node to branch; play audio via the bottom player (single `<audio>` with visualizer).
- backend smoke (while server is running):
```bash
curl -s -X POST http://127.0.0.1:8000/sessions \
  -H "content-type: application/json" \
  -d '{"brief":"warm pads","num_clips":3,"params":{"energy":0.6,"density":0.4,"duration_sec":8,"tempo_bpm":110,"brightness":0.4}}'
```

### api at a glance (served by backend)
- `POST /sessions` → create a session + initial batch. body: `brief`, `num_clips` (1–6), `params` (`energy`, `density`, `duration_sec`, `tempo_bpm`, `brightness`). returns `{session_id, batch:{id, clusters:[{id, label, tracks:[{id, audio_url, duration_sec}]}]}}`.
- `POST /sessions/{session_id}/clusters/{cluster_id}/more` → generate more near a cluster. body: `num_clips`. label is inherited; tracks filtered by cosine similarity to the parent centroid.
- `DELETE /media-cache` → clear media directory (dev-only convenience).
- `POST /music/settings` → currently supports `{force_instrumental:boolean}` for providers that expose it.
- `GET /health` → `{status:"ok"}`.

### backend config (env; defaults favor fakes)
- prefix `SUNO_LAB_`. key fields: `MUSIC_PROVIDER` (`fake` default, or `elevenlabs`), `MEDIA_ROOT` (default `backend/media`), `MAX_BATCH_SIZE` (default 6), `DEFAULT_MAX_K` (3), `MIN_SIMILARITY` (0.3), `CLAP_ENABLED` (false), `CLAP_MODEL_NAME`, `OPENAI_API_KEY`, `USE_FAKE_NAMER`, `ELEVENLABS_API_KEY`, `ELEVENLABS_OUTPUT_FORMAT`, `ELEVENLABS_FORCE_INSTRUMENTAL` (default true).
- see `backend/README.md` for full matrix and behavior notes (CLAP, OpenAI namer, ElevenLabs).

### testing
- backend: `cd backend && source .venv/bin/activate && pytest` (uses fake providers; no network).
- frontend: `cd frontend && npm run test` (vitest/jsdom).

### things to know (cto/juniors)
- state is in-memory; restart wipes sessions. for real deployments you’d add persistent store + shared media.
- media dir must be writable; `/media` is statically served by fastapi.
- defaults keep everything offline (fake music, fake embeddings, fake namer). enabling real providers pulls in heavy deps (torch/clap) or paid apis (elevenlabs/openai).
- the frontend clears media on mount and the backend clears on startup to avoid stale audio during iteration; don’t treat that as production-ready behavior.
- error handling is explicit: invalid requests → 400, missing session/cluster → 404, provider failures → 500.
