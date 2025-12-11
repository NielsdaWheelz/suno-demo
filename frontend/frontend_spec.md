# frontend_spec.md

## 1. problem, solution, scope
- problem: “prompt → generate → repeat” is hard to navigate; users lose track of where they’ve been.
- solution: node-based branching UI (generation rows with lineage lines) over a simple two-endpoint backend. Fixed 3 clips per generation in the UI; centralized playback with a single bottom player + visualizer.
- scope: no auth, no routing, no persistence. All state is per page load. Dark theme only.

## 2. high-level ux layout
- shell layout: three fixed zones.
  - left sidebar: static title/nav (non-interactive).
  - main panel: two-column grid.
    - left: `ControlPanel` (brief textarea; sliders for energy/density/duration_sec/tempo_bpm/brightness; “instrumental only” checkbox; generate button).
    - right: `NodeGrid` (rows by generationIndex, nodes with play + “more like this”, SVG lineage lines).
  - bottom player: docked bar with single `<audio>` + canvas visualizer; auto-plays when selection changes; shows label + short id; idle message when none.
- responsive rules: sidebar ~220px; bottom bar fixed height; main scrolls.

## 3. user flows (step-by-step)
- initial session creation (`POST /sessions`):
  - user enters brief, tweaks sliders/toggles, clicks generate (UI uses `num_clips = 3`).
  - state: `status="loading"`, clear `errorMessage`, disable generate.
  - on success: map `batch.clusters` to `NodeView[]` (one node per track) with `generationIndex=0`; set `sessionId`, `nextGenerationIndex=1`, `selectedNodeId=first node`, `status="idle"`.
  - on error: set `status="error"`, surface message in control panel.
- displaying nodes:
  - `NodeGrid` groups by `generationIndex`, renders rows, draws lines from each node to its `parentNodeId` when present.
- playback:
  - play buttons call `playTrack` (via `PlayerContext`) and set `selectedNodeId`.
  - `BottomPlayer` resets + auto-plays the new source; visualizer runs via Web Audio analyser.
- “more like this” (`POST /sessions/{session_id}/clusters/{cluster_id}/more`):
  - user clicks on a node → mutate with that node’s `backendClusterId` and `num_clips=3`.
  - on success: flatten response cluster to nodes with `generationIndex=nextGenerationIndex` and `parentNodeId=node.id`; append; increment `nextGenerationIndex`; keep `selectedNodeId` on the parent.
  - on error: `status="error"` + message.
- loading states:
  - global loading (no per-node spinner yet); disables play/more-like.

## 4. exact typescript data contracts
```ts
export type BriefParams = {
  energy: number;
  density: number;
  duration_sec: number;
  tempo_bpm: number;
  brightness: number;
};

export interface CreateSessionRequest { brief: string; num_clips: number; params: BriefParams; }
export interface TrackOut { id: string; audio_url: string; duration_sec: number; }
export interface ClusterOut { id: string; label: string; tracks: TrackOut[]; }
export interface BatchOut { id: string; clusters: ClusterOut[]; }
export interface CreateSessionResponse { session_id: string; batch: BatchOut; }
export interface MoreLikeResponse { session_id: string; parent_cluster_id: string; batch: BatchOut; }
export interface MusicSettingsUpdate { force_instrumental: boolean; }

export type NodeId = string;
export type NodeView = {
  id: NodeId;
  track: TrackOut;
  label: string;
  generationIndex: number;
  parentNodeId?: NodeId;
  backendClusterId: string;
};

export type SessionStatus = "idle" | "loading" | "error";
export type SessionState = {
  sessionId: string | null;
  nodes: NodeView[];
  status: SessionStatus;
  errorMessage?: string;
  nextGenerationIndex: number;
  selectedNodeId?: NodeId;
};

export type ControlPanelState = {
  brief: string;
  params: BriefParams;
  canGenerate: boolean;
  loading: boolean;
  errorMessage?: string;
  forceInstrumental: boolean;
};
```
Property names mirror backend JSON (snake_case where present).

### component props (current)
```ts
export interface ShellLayoutProps { sidebar: React.ReactNode; main: React.ReactNode; bottom: React.ReactNode; }
export interface SidebarProps { title: string; items: { id: string; label: string }[]; }
export interface MainPanelProps { left: React.ReactNode; right: React.ReactNode; }

export interface ControlPanelProps extends ControlPanelState {
  onBriefChange: (v: string) => void;
  onParamsChange: (p: BriefParams) => void;
  onGenerate: () => void;
  onForceInstrumentalChange: (v: boolean) => void;
}

export interface NodeGridProps {
  nodes: NodeView[];
  status: SessionStatus;
  onMoreLike: (node: NodeView) => void;
  onPlay: (node: NodeView) => void;
  selectedNodeId?: NodeId;
  onSelect: (node: NodeView) => void;
}

export interface NodeCardProps {
  node: NodeView;
  selected?: boolean;
  disabled?: boolean;
  onMoreLike: (node: NodeView) => void;
  onPlay: (node: NodeView) => void;
  onSelect: (node: NodeView) => void;
}

export interface TrackTileProps {
  track: TrackOut;
  clusterLabel: string;
}

export type PlayerContextValue = {
  currentTrack?: { track: TrackOut; clusterLabel: string };
  playTrack: (track: TrackOut, clusterLabel: string) => void;
};
```

## 5. component tree (current)
- App
  - wraps `AppContent` in `PlayerProvider`.
  - owns `SessionState`, `ControlPanelState`; wires react-query mutations; passes play/more-like/select handlers to `NodeGrid`.
- ShellLayout: structural grid with sidebar/main/bottom slots.
- ControlPanel: controlled inputs for brief + sliders + checkbox; fixed `num_clips=3`.
- NodeGrid: groups nodes by generation, draws SVG lineage lines, renders `NodeCard`.
- NodeCard: shows label/parent; buttons for play + “more like this”.
- TrackTile: minimal play button (uses `usePlayer`).
- BottomPlayer: single `<audio>` with visualizer; idle state when no selection.

## 6. api client contract (ts)
- `createSession(body: CreateSessionRequest): Promise<CreateSessionResponse>`
- `moreLikeCluster(sessionId, clusterId, body: { num_clips: number }): Promise<MoreLikeResponse>`
- `clearMediaCache(): Promise<void>` (DELETE `/media-cache`)
- `updateMusicSettings(body: MusicSettingsUpdate): Promise<void>`
- errors: non-2xx → throw `ApiError(message, status, parsedBody?)`.
- base URL: `import.meta.env.VITE_API_BASE` (required).

## 7. state management strategy
- `react-query` for mutations only (no cached queries).
- App holds canonical `SessionState` and `ControlPanelState`; `NUM_CLIPS` is a constant = 3.
- createSession mutation:
  - on mutate → `status="loading"`, clear errors.
  - on success → flatten batch to nodes, set `nextGenerationIndex=1`, select first node, `status="idle"`.
  - on error → `status="error"`, set messages.
- moreLike mutation:
  - guard `sessionId`.
  - on success → append nodes with `generationIndex=nextGenerationIndex`, set `selectedNodeId` to parent, increment `nextGenerationIndex`.
  - on error → `status="error"`, set messages.
- media cache is cleared on mount via `clearMediaCache()` (dev convenience).

## 8. styling & theming (high level)
- tailwind; dark theme (`bg-slate-95x`, `text-slate-100`).
- layout: `[sidebar|main]` grid, bottom bar spans both columns.
- NodeGrid: rows of three on ≥sm, SVG overlay for lineage lines, subtle selection state on NodeCard.
- BottomPlayer: layered canvas under controls (opacity), ensures `crossOrigin="anonymous"` for analyser.

## 9. system diagram
- data path: `ControlPanel → createSession → nodesFromInitialBatch → NodeGrid` → user clicks → `moreLikeCluster` → `nodesFromMoreLike` → NodeGrid rerenders. Playback goes through `PlayerContext` → `BottomPlayer` (single `<audio>` + analyser). Media URLs resolved via `resolveApiUrl` to support backend/front on different origins.