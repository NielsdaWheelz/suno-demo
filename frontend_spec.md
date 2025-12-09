# frontend_spec.md

## 1. problem, solution, scope
- problem: users need a lightweight suno-like UI to submit a brief + params, see clustered results at a glance, and iterate with “more like this.”
- solution: single-page react app (ts + vite + tailwind) that mirrors suno studio structure but only implements prompt entry, param sliders, generate, cluster grid, per-track audio, and “more like this.”
- scope: no auth, no routing, no persistence, no editing workflow, no advanced audio controls; left nav and bottom player are placeholders with minimal behavior; all state is in-memory per page load.

## 2. high-level ux layout
- shell layout: three fixed zones.
  - left sidebar (placeholder nav): narrow column with app title and static nav items; non-interactive.
  - main panel (functional area): stacked: control panel on top, cluster grid below.
    - control panel: brief textarea, num_clips selector (1–6), sliders for energy/density/duration, generate button, inline status/error area.
    - results: cluster grid in “quadrant” feel (cards in a grid). each cluster card shows label, “more like this” button, and a grid of track tiles with audio controls.
  - bottom player (placeholder): docked bar; shows currently selected track title/cluster label and a simple `<audio>` with play/pause. if no selection, show “select a track to preview.” no queue, no waveform.
- responsive rules: sidebar fixed width ~220px; bottom player fixed height ~72px; main panel scrolls.

## 3. user flows (step-by-step)
- initial session creation (POST `/sessions`):
  - user enters brief, adjusts sliders, chooses num_clips, clicks generate.
  - ControlPanel enforces num_clips as integer in [1, 6]; invalid values cannot be submitted.
  - state: `status` → `loading`; clear `errorMessage`; disable generate and inputs.
  - call `createSession`; on success set `sessionId`, flatten `batch.clusters` into `clusters` with `source="initial"`, `status` → `idle`; render grid. on failure set `status="error"`, `errorMessage` with returned message or fallback, keep previous clusters (if any), re-enable controls.
  - loading UI: button shows spinner/text, cluster area shows “generating…” placeholder if empty.
- displaying clusters from initial batch:
  - clusters sorted by arrival order (initial batch order).
  - grid renders cards; each card shows label, source tag (“initial”), and track tiles.
  - no pagination; all clusters visible; empty state text when no clusters.
- playing a track:
  - each track tile has inline `<audio controls>` (default browser) and “set to bottom player” button/icon.
  - selecting a track sets BottomPlayer state: track id, label, audio_url. bottom player’s `<audio>` loads that url; playing is manual via native controls.
  - no cross-tile sync; multiple audios can play if user starts them; no enforced stop.
- requesting “more like this” (POST `/sessions/{session_id}/clusters/{cluster_id}/more`):
  - user clicks “more like this” on a cluster card; button disabled if `sessionId` null or a request already in flight for that cluster.
  - state: `status` → `loading`; set `loadingClusterId = clusterId`; `errorMessage` cleared.
  - call `moreLikeCluster(sessionId, clusterId, { num_clips })` using current num_clips input; assume `resp.batch.clusters.length === 1`; map `const c = resp.batch.clusters[0]`; append `{ ...c, source: "more", parentClusterId: resp.parent_cluster_id }` to `clusters`; `status` → `idle`; `loadingClusterId = undefined`. on failure set `status="error"`, show banner in control panel, leave existing clusters intact, re-enable buttons, clear `loadingClusterId`.
  - new clusters appear at end of grid; parent not mutated.
- error states:
  - network or 4xx/5xx → show red banner in control panel with text; `status="error"`. global `errorMessage` is rendered in the control panel, not per-card.
  - if sessionId missing when “more like this” clicked → show inline warning and do nothing.
  - audio load error uses native `<audio>` message; no custom retry.
- loading states:
  - global loading covers any mutation; buttons disabled; cursor shows busy.
  - per-cluster “more like this” shows spinner when `loadingClusterId === cluster.id`.
  - bottom player unaffected by loading.

## 4. exact typescript data contracts
```ts
export type BriefParams = { energy: number; density: number; durationSec: number };

export interface CreateSessionRequest { brief: string; num_clips: number; params: BriefParams; }

export interface TrackOut { id: string; audio_url: string; duration_sec: number; }

export interface ClusterOut { id: string; label: string; tracks: TrackOut[]; }

export interface BatchOut { id: string; clusters: ClusterOut[]; }

export interface CreateSessionResponse { session_id: string; batch: BatchOut; }

export interface MoreLikeResponse { session_id: string; parent_cluster_id: string; batch: BatchOut; }

export type ClusterView = {
  id: string;
  label: string;
  tracks: TrackOut[];
  parentClusterId?: string;
  source: "initial" | "more";
};

export type SessionState = {
  sessionId: string | null;
  clusters: ClusterView[];
  status: "idle" | "loading" | "error";
  loadingClusterId?: string;
  errorMessage?: string;
};
```
property names in TS interfaces intentionally mirror backend JSON (snake_case). components must use these names directly, not camelCase.

component prop types:
```ts
export interface ShellLayoutProps { sidebar: React.ReactNode; main: React.ReactNode; bottom: React.ReactNode; }

export interface SidebarProps { title: string; items: { id: string; label: string }[]; }

export interface MainPanelProps {
  sessionState: SessionState;
  onGenerate: (input: CreateSessionRequest) => void;
  onMoreLike: (clusterId: string, numClips: number) => void;
  controlsState: ControlPanelState;
}

export type ControlPanelState = {
  brief: string;
  numClips: number;
  params: BriefParams;
  canGenerate: boolean;
  loading: boolean;
  errorMessage?: string;
};
// numClips is always an integer in [1, 6]; UI clamps via stepper/validated number input so invalid values cannot be submitted.

export interface ControlPanelProps extends ControlPanelState {
  onBriefChange: (v: string) => void;
  onNumClipsChange: (v: number) => void;
  onParamsChange: (p: BriefParams) => void;
  onGenerate: () => void;
}

export interface ClusterGridProps {
  clusters: ClusterView[];
  sessionId: string | null;
  loading: boolean;
  onMoreLike: (clusterId: string) => void;
  numClips: number;
}

export interface ClusterCardProps {
  cluster: ClusterView;
  disabled: boolean; // typically status === "loading" || loadingClusterId === cluster.id
  onMoreLike: (clusterId: string) => void;
  onTrackSelect: (track: TrackOut, clusterLabel: string) => void;
}

export interface TrackTileProps {
  track: TrackOut;
  clusterLabel: string;
  onSelect: (track: TrackOut, clusterLabel: string) => void;
}

export interface BottomPlayerProps {
  currentTrack?: { track: TrackOut; clusterLabel: string };
}
```

## 5. component tree (full)
- App
  - responsibilities: own `SessionState`, `controlsState`, react-query mutations, wiring callbacks; render ShellLayout.
  - renders: ShellLayout with Sidebar, MainPanel, BottomPlayer.
  - events: handles generate/more-like, updates currentTrack for BottomPlayer.
  - ownership: owns `currentTrack` state and passes to BottomPlayer; ClusterCard/TrackTile raise `onTrackSelect` up to App.
- ShellLayout
  - props: `ShellLayoutProps`.
  - responsibilities: structural layout with fixed sidebar and bottom bar.
  - renders: three slots.
  - events: none.
- Sidebar
  - props: `SidebarProps`.
  - responsibilities: static nav mimic; highlight nothing.
  - renders: title + list of items.
  - events: none (placeholder).
- MainPanel
  - props: `MainPanelProps`.
  - responsibilities: orchestrate control panel and cluster grid; surface errors/loading.
  - renders: ControlPanel, status/error banner, ClusterGrid.
  - events: forwards generate/more-like.
- ControlPanel
  - props: `ControlPanelProps`.
  - responsibilities: collect inputs; clamp `numClips` to integer [1, 6]; show loading/error; disable during mutations.
  - renders: textarea for brief, numeric input for num_clips (step 1, min 1, max 6), three sliders (energy/density/duration), generate button, helper text.
  - events: onChange handlers; onGenerate click.
- ClusterGrid
  - props: `ClusterGridProps`.
  - responsibilities: render clusters in responsive grid; empty states; pass callbacks.
  - renders: grid of ClusterCard; empty text if none and not loading; “generating…” placeholder if loading and no data.
  - events: per-card onMoreLike, onTrackSelect.
- ClusterCard
  - props: `ClusterCardProps`.
  - responsibilities: show cluster label, source tag, tracks, per-card action button with loading/disabled state.
  - renders: header (label, source tag, parent info if present), “more like this” button, grid of TrackTile.
  - events: onMoreLike click; onTrackSelect forwarded.
- TrackTile
  - props: `TrackTileProps`.
  - responsibilities: show track id short, duration text, audio element, select-to-bottom-player control.
  - renders: small card with `<audio controls src={track.audio_url}>`; select button.
  - events: onSelect.
- BottomPlayer
  - props: `BottomPlayerProps`.
  - responsibilities: placeholder bar; show selected track label/id; provide single `<audio controls>` for selected; show idle text when none.
  - renders: label area + audio element.
  - events: none (playback is native).

## 6. api client contract (ts)
file: `src/api/client.ts`
- exports:
```ts
export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown);
}

export async function createSession(body: CreateSessionRequest): Promise<CreateSessionResponse>;

export async function moreLikeCluster(
  sessionId: string,
  clusterId: string,
  body: { num_clips: number }
): Promise<MoreLikeResponse>;
```
- behavior:
  - use fetch; set `Content-Type: application/json`.
  - on non-2xx: parse json if possible; throw `ApiError(message, status, parsedBody)`.
  - no retries, no hidden mutations.
  - return parsed JSON typed as above; caller is responsible for runtime guarding if needed.
  - base URL comes from env (e.g., `import.meta.env.VITE_API_BASE`); paths `/sessions` and `/sessions/{session_id}/clusters/{cluster_id}/more`.

## 7. state management strategy
- library: react-query for mutations only; queries disabled.
- cache keys:
  - create session mutation key: `["session", "create"]`.
  - more-like mutation key: `["session", "more", sessionId, clusterId]`.
- App holds `SessionState` in `useState` (or useReducer) and `currentTrack` for BottomPlayer.
- mutation flows:
  - createSession mutation: on mutate → set `status="loading"`. on success → set `sessionId` and `clusters` mapped to `ClusterView` (`source="initial"`). on error → `status="error"`, set `errorMessage`.
  - moreLike mutation: guard requires `sessionId`; on mutate → set `status="loading"` and `loadingClusterId = clusterId`. on success → append `ClusterView` with `source="more"`, `parentClusterId` from response; clear `loadingClusterId`. on error → `status="error"`, set `errorMessage`, clear `loadingClusterId`.
- no react-query cache consumption; state is canonical in App; mutations only used for lifecycle and retries if desired.
- inputs (brief/params/numClips) live in `controlsState` in App; ControlPanel is controlled.

## 8. styling & theming
- tailwind required; dark theme base (`bg-slate-950`, `text-slate-100`).
- primitives:
  - Button: `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-500`.
  - Card: `rounded-lg border border-slate-800 bg-slate-900 shadow-sm`.
  - Slider: use `<input type="range">` with tailwind wrappers; display value beside label; range 0–1 (energy/density, step 0.01), duration 1–10 (step 0.5) mapped to `BriefParams.durationSec`; backend allows up to 30s but v1 intentionally caps UI to 10s; default 0.5 energy/density, 8s duration.
  - Tag: small pill `text-xs rounded-full px-2 py-1 bg-slate-800 text-slate-200`.
- layout rules:
  - Shell: `grid` with columns `[220px, 1fr]` and rows `[1fr, 72px]`; bottom player spans both columns; main scrolls; sidebar fixed.
  - Main panel content width: max-w-6xl, center aligned with padding `px-6 py-4`.
  - ClusterGrid: CSS grid; gap `gap-4`; columns: 1 on <768px, 2 on ≥768px, 3 on ≥1280px. Cards stretch height to fit content.
  - TrackTile grid inside card: grid with 2 columns (stack to 1 on narrow screens); gap `gap-3`.
- audio tile dimensions: TrackTile min-width 180px, padding `p-3`; audio element full width; include duration text (`~{duration_sec}s`).
- error banner: red background `bg-red-900/70 border border-red-700 text-red-100`.
- loading indicators: text + spinner icon (optional) using tailwind animate-spin.

## 9. system diagram
- data path: `UI components (ControlPanel → ClusterGrid/TrackTile → BottomPlayer)` → `api/client.ts` → backend endpoints (`POST /sessions`, `POST /sessions/{session_id}/clusters/{cluster_id}/more`) → responses mapped to `SessionState` → rerender `ClusterGrid` and `BottomPlayer`.

## 10. pr roadmap (with required tests)
1) scaffold (vite/react/ts/tailwind, ShellLayout/Sidebar/BottomPlayer placeholders).  
   - tests: rendering smoke for ShellLayout slots; Sidebar renders title/items; BottomPlayer renders idle state.  
2) types + api/client.ts + ControlPanel.  
   - tests: api client throws ApiError on non-2xx; ControlPanel sliders/numClips updates; generate button fires only when `canGenerate === true`; numClips clamped to [1, 6].  
3) App state wiring with react-query mutations; initial session flow.  
   - tests: successful createSession maps batch → ClusterView (source initial); loading/error states set; error banner shows.  
4) ClusterGrid/ClusterCard/TrackTile rendering initial batch.  
   - tests: renders correct cluster/track counts from fake SessionState; clicking track tile triggers onTrackSelect; “more like this” button disables when `disabled` true.  
5) “more like this” flow.  
   - tests: per-card loading (`loadingClusterId`) set/cleared; maps MoreLikeResponse single cluster with parentClusterId; append order preserved.  
6) styling polish (dark theme, grid responsiveness, primitives).  
   - tests: basic snapshot/layout class presence for grid columns at breakpoints; BottomPlayer displays selected track when provided.  
7) manual sanity against backend (happy path, error path, audio playback).  
   - tests: lightweight e2e/dev harness checklist (documented), not automated.