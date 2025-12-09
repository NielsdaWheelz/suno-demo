frontend pr roadmap

⸻

PR0 – project scaffold + shell layout skeleton

goal: vite + react + ts + tailwind set up, with the basic 3-zone layout (sidebar, main, bottom) but no real state, no API.

scope (only):
	•	create vite project (react-ts template).
	•	integrate tailwind.
	•	implement these components:

// src/components/ShellLayout.tsx
export interface ShellLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  bottom: React.ReactNode;
}
export function ShellLayout(props: ShellLayoutProps): JSX.Element { ... }

// src/components/Sidebar.tsx
export interface SidebarProps {
  title: string;
  items: { id: string; label: string }[];
}
export function Sidebar(props: SidebarProps): JSX.Element { ... }

// src/components/BottomPlayer.tsx
export interface BottomPlayerProps {
  currentTrack?: { trackId: string; label: string };
}
export function BottomPlayer(props: BottomPlayerProps): JSX.Element { ... }

// src/components/MainPanel.tsx
export interface MainPanelProps {
  children?: React.ReactNode;
}
export function MainPanel(props: MainPanelProps): JSX.Element { ... }


	•	App.tsx just wires these together with dummy content:

export function App() {
  return (
    <ShellLayout
      sidebar={<Sidebar title="Suno Session Lab" items={[...]} />}
      main={<MainPanel><div>TODO</div></MainPanel>}
      bottom={<BottomPlayer />}
    />
  );
}


	•	layout: use CSS grid as described in spec (no need to be pixel-perfect yet).

tests (write first):
	•	src/components/__tests__/ShellLayout.test.tsx
	•	renders children in correct regions (sidebar, main, bottom).
	•	Sidebar.test.tsx
	•	renders title + all items.
	•	BottomPlayer.test.tsx
	•	when currentTrack undefined → shows “select a track” text.
	•	when provided → shows label.

what NOT to do in this PR:
	•	no API types, no state management.
	•	no ControlPanel/ClusterGrid.
	•	no fetch, no react-query.

⸻

PR1 – API + UI type definitions, api/client.ts (no wiring yet)

goal: lock the TS data contracts and the API client surface. still no real app state.

scope:
	•	src/types/api.ts:

export type BriefParams = { energy: number; density: number; durationSec: number };

export interface CreateSessionRequest { brief: string; num_clips: number; params: BriefParams; }

export interface TrackOut { id: string; audio_url: string; duration_sec: number; }

export interface ClusterOut { id: string; label: string; tracks: TrackOut[]; }

export interface BatchOut { id: string; clusters: ClusterOut[]; }

export interface CreateSessionResponse { session_id: string; batch: BatchOut; }

export interface MoreLikeResponse { session_id: string; parent_cluster_id: string; batch: BatchOut; }


	•	src/types/ui.ts:

import type { TrackOut } from "./api";

export type ClusterView = {
  id: string;
  label: string;
  tracks: TrackOut[];
  parentClusterId?: string;
  source: "initial" | "more";
};

export type SessionStatus = "idle" | "loading" | "error";

export type SessionState = {
  sessionId: string | null;
  clusters: ClusterView[];
  status: SessionStatus;
  loadingClusterId?: string; // for per-cluster spinner (can be undefined)
  errorMessage?: string;
};

export type ControlPanelState = {
  brief: string;
  numClips: number; // always integer [1, 6]
  params: { energy: number; density: number; durationSec: number };
  canGenerate: boolean;
  loading: boolean;
  errorMessage?: string;
};


	•	src/api/client.ts:

import {
  CreateSessionRequest,
  CreateSessionResponse,
  MoreLikeResponse,
} from "../types/api";

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE ?? "";

export async function createSession(
  body: CreateSessionRequest,
): Promise<CreateSessionResponse> {
  const res = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = undefined;
    }
    throw new ApiError("createSession failed", res.status, parsed);
  }
  return (await res.json()) as CreateSessionResponse;
}

export async function moreLikeCluster(
  sessionId: string,
  clusterId: string,
  body: { num_clips: number },
): Promise<MoreLikeResponse> {
  const res = await fetch(
    `${BASE_URL}/sessions/${sessionId}/clusters/${clusterId}/more`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = undefined;
    }
    throw new ApiError("moreLikeCluster failed", res.status, parsed);
  }
  return (await res.json()) as MoreLikeResponse;
}



tests:
	•	api/client.test.ts (mock global.fetch):
	•	success path: verify correct URL, method, body; resolve with 200 + JSON; function returns typed data.
	•	non-2xx: verify ApiError is thrown with correct .status.

what NOT to do:
	•	no App wiring.
	•	no react-query.
	•	no UI changes except imports compile.

⸻

PR2 – ControlPanel component + local control state (no network)

goal: build the control panel UI and local state wiring inside App, but still stub onGenerate (no backend).

scope:
	•	src/components/ControlPanel.tsx:

import type { BriefParams } from "../types/api";
import type { ControlPanelState } from "../types/ui";

export interface ControlPanelProps extends ControlPanelState {
  onBriefChange: (v: string) => void;
  onNumClipsChange: (v: number) => void;
  onParamsChange: (p: BriefParams) => void;
  onGenerate: () => void;
}

export function ControlPanel(props: ControlPanelProps): JSX.Element { ... }

behavior requirements:
	•	numClips input is clamped to [1, 6] and integer (e.g. use stepper or manual clamp).
	•	sliders:
	•	energy, density: 0–1, step 0.01.
	•	durationSec: 1–10, step 0.5.
	•	generate button:
	•	disabled when !canGenerate || loading.
	•	calls onGenerate() once on click.

	•	App.tsx:
	•	add local control state:

const [controls, setControls] = useState<ControlPanelState>({
  brief: "",
  numClips: 3,
  params: { energy: 0.5, density: 0.5, durationSec: 8 },
  canGenerate: true,
  loading: false,
  errorMessage: undefined,
});


	•	handle onBriefChange, onNumClipsChange, onParamsChange to update state.
	•	onGenerate for now just console.log the payload; no API call yet.
	•	MainPanel props updated to accept:

// simplify MainPanel to:
export interface MainPanelProps {
  controlPanel: React.ReactNode;
  clustersArea: React.ReactNode;
  status: SessionStatus;
  errorMessage?: string;
}


and App passes controlPanel=<ControlPanel ...> and placeholder clusters area.

tests:
	•	ControlPanel.test.tsx:
	•	typing into brief calls onBriefChange with new value.
	•	changing num_clips tries to go below 1 or above 6 → clamped in callback.
	•	clicking generate when enabled calls onGenerate exactly once.
	•	when loading=true, generate is disabled.
	•	simple App.test.tsx:
	•	renders ControlPanel with initial values (brief empty, sliders at defaults).

what NOT to do:
	•	no usage of createSession yet.
	•	no ClusterGrid.

⸻

PR3 – ClusterGrid, ClusterCard, TrackTile (purely from mock data)

goal: build the result grid components and their props, but still no network and no real session state. App feeds them mock ClusterView[].

scope:
	•	src/components/TrackTile.tsx:

import type { TrackOut } from "../types/api";

export interface TrackTileProps {
  track: TrackOut;
  clusterLabel: string;
  onSelect: (track: TrackOut, clusterLabel: string) => void;
}

export function TrackTile(props: TrackTileProps): JSX.Element { ... }

behavior:
	•	show short id (e.g. track.id.slice(0, 8)), duration text.
	•	<audio controls src={track.audio_url}>.
	•	“Select” button that calls onSelect(track, clusterLabel).

	•	src/components/ClusterCard.tsx:

import type { ClusterView } from "../types/ui";

export interface ClusterCardProps {
  cluster: ClusterView;
  disabled: boolean;
  onMoreLike: (clusterId: string) => void;
  onTrackSelect: (track: TrackOut, clusterLabel: string) => void;
}

export function ClusterCard(props: ClusterCardProps): JSX.Element { ... }

behavior:
	•	header shows cluster.label and cluster.source tag.
	•	if cluster.parentClusterId exists, show “from ”.
	•	“More like this” button:
	•	disabled when disabled true.
	•	calls onMoreLike(cluster.id) once on click.
	•	renders each track with TrackTile.

	•	src/components/ClusterGrid.tsx:

import type { ClusterView, SessionStatus } from "../types/ui";

export interface ClusterGridProps {
  clusters: ClusterView[];
  sessionId: string | null;
  status: SessionStatus;
  loadingClusterId?: string;
  numClips: number;
  onMoreLike: (clusterId: string) => void;
  onTrackSelect: (track: TrackOut, clusterLabel: string) => void;
}

export function ClusterGrid(props: ClusterGridProps): JSX.Element { ... }

behavior:
	•	if status === "loading" and clusters.length === 0 → show “generating…” placeholder.
	•	if status === "idle" and clusters.length === 0 → show “no results yet” text.
	•	otherwise render grid of ClusterCard.
	•	compute disabled for each card as status === "loading" || loadingClusterId === cluster.id || !sessionId.

	•	App.tsx:
	•	create mock ClusterView[] and feed to ClusterGrid just to exercise the UI. No real API yet.

tests:
	•	ClusterGrid.test.tsx:
	•	with empty clusters + idle → “no results yet”.
	•	with empty clusters + loading → “generating…” text.
	•	with clusters → renders one ClusterCard per cluster.
	•	ClusterCard.test.tsx:
	•	“more like this” button calls handler when enabled, not when disabled.
	•	renders all tracks.
	•	TrackTile.test.tsx:
	•	renders <audio> with correct src.
	•	“select” button calls onSelect.

what NOT to do:
	•	still no createSession/moreLikeCluster calls.
	•	no real SessionState yet; just mock data.

⸻

PR4 – wire createSession API + real SessionState (initial batch only)

goal: hook the control panel to the real backend via createSession, populate SessionState, and render real clusters in the grid. no “more like this” yet.

scope:
	•	introduce react-query (@tanstack/react-query) with a QueryClientProvider in main.tsx.
	•	in App.tsx:
	•	add SessionState state:

const [session, setSession] = useState<SessionState>({
  sessionId: null,
  clusters: [],
  status: "idle",
  loadingClusterId: undefined,
  errorMessage: undefined,
});


	•	add currentTrack state for BottomPlayer (but you don’t have to render audio yet; can pass label only).
	•	set up useMutation(createSession):

const createSessionMutation = useMutation({
  mutationFn: (body: CreateSessionRequest) => createSession(body),
  onMutate: () => {
    setSession((prev) => ({ ...prev, status: "loading", errorMessage: undefined }));
    setControls((prev) => ({ ...prev, loading: true, errorMessage: undefined }));
  },
  onSuccess: (data) => {
    const clusters: ClusterView[] = data.batch.clusters.map((c) => ({
      id: c.id,
      label: c.label,
      tracks: c.tracks,
      source: "initial",
    }));
    setSession({
      sessionId: data.session_id,
      clusters,
      status: "idle",
      loadingClusterId: undefined,
      errorMessage: undefined,
    });
    setControls((prev) => ({ ...prev, loading: false }));
  },
  onError: (err) => {
    const message =
      err instanceof ApiError ? `Request failed (${err.status})` : "Unknown error";
    setSession((prev) => ({ ...prev, status: "error", errorMessage: message }));
    setControls((prev) => ({ ...prev, loading: false, errorMessage: message }));
  },
});


	•	onGenerate now:

const handleGenerate = () => {
  const body: CreateSessionRequest = {
    brief: controls.brief,
    num_clips: controls.numClips,
    params: controls.params,
  };
  createSessionMutation.mutate(body);
};


	•	wire MainPanel with real session.status, session.errorMessage, ClusterGrid with real session.clusters and session.sessionId.
	•	ClusterGrid.onMoreLike can still be a console.warn placeholder for now.

tests:
	•	use MSW or a jest fetch mock in App.createSession integration test:
	•	when createSession resolves, the grid ends up with the correct number of clusters and tracks mapped from the response.
	•	test error path:
	•	mock createSession to reject with ApiError(500) and assert that:
	•	session.status === "error"
	•	ControlPanel displays error banner.

what NOT to do:
	•	don’t implement moreLikeCluster yet.
	•	don’t implement per-cluster loading.

⸻

PR5 – implement “more like this” flow (API + per-cluster loading)

goal: wire the moreLikeCluster API, append new clusters, and implement per-cluster loading/disable semantics.

scope:
	•	in App.tsx:
	•	add moreLikeClusterMutation:

const moreLikeMutation = useMutation({
  mutationFn: ({
    sessionId,
    clusterId,
    numClips,
  }: { sessionId: string; clusterId: string; numClips: number }) =>
    moreLikeCluster(sessionId, clusterId, { num_clips: numClips }),
  onMutate: ({ clusterId }) => {
    setSession((prev) => ({
      ...prev,
      status: "loading",
      loadingClusterId: clusterId,
      errorMessage: undefined,
    }));
  },
  onSuccess: (data) => {
    const parentId = data.parent_cluster_id;
    const c = data.batch.clusters[0]; // spec: exactly one
    const newCluster: ClusterView = {
      id: c.id,
      label: c.label,
      tracks: c.tracks,
      source: "more",
      parentClusterId: parentId,
    };
    setSession((prev) => ({
      sessionId: data.session_id,
      clusters: [...prev.clusters, newCluster],
      status: "idle",
      loadingClusterId: undefined,
      errorMessage: undefined,
    }));
  },
  onError: (err) => {
    const message =
      err instanceof ApiError ? `Request failed (${err.status})` : "Unknown error";
    setSession((prev) => ({
      ...prev,
      status: "error",
      loadingClusterId: undefined,
      errorMessage: message,
    }));
  },
});


	•	ClusterGrid.onMoreLike in App:

const handleMoreLike = (clusterId: string) => {
  if (!session.sessionId) return;
  moreLikeMutation.mutate({
    sessionId: session.sessionId,
    clusterId,
    numClips: controls.numClips,
  });
};


	•	pass session.loadingClusterId properly into ClusterGrid. ClusterGrid already calculates disabled.

tests:
	•	integration test for moreLike:
	•	start with a SessionState with one initial cluster.
	•	simulate click on “more like this”:
	•	mock moreLikeCluster to return a response with one new cluster.
	•	assert that after resolve, there are 2 clusters, and second has source === "more" and parentClusterId set.
	•	error case:
	•	mock rejection → check status="error", error banner, and loadingClusterId cleared.

what NOT to do:
	•	no styling polish yet beyond what’s needed to keep layout sane.
	•	no changes to ControlPanel, except maybe disabling “more like this” when sessionId null (already done).

⸻

PR6 – BottomPlayer + track selection wiring

goal: make the bottom bar actually play the selected track using a single <audio> element.

scope:
	•	update BottomPlayerProps to use full track:

import type { TrackOut } from "../types/api";

export interface BottomPlayerProps {
  currentTrack?: { track: TrackOut; clusterLabel: string };
}


	•	BottomPlayer:
	•	when currentTrack undefined → show “select a track to preview”.
	•	when defined → show clusterLabel + track id slice and <audio controls src={currentTrack.track.audio_url}>.
	•	in App.tsx:
	•	maintain:

const [currentTrack, setCurrentTrack] = useState<
  { track: TrackOut; clusterLabel: string } | undefined
>(undefined);


	•	pass onTrackSelect down to ClusterGrid → ClusterCard → TrackTile.
	•	TrackTile.onSelect uses setCurrentTrack.

tests:
	•	BottomPlayer.test.tsx:
	•	when currentTrack provided, renders <audio> with expected src.
	•	integration:
	•	simulate clicking “Select” on a TrackTile → BottomPlayer shows that track.

what NOT to do:
	•	do not add playlist/queue logic.
	•	no synchronization between inline <audio> in tiles and bottom player.

⸻

PR7 – styling & polish (dark theme, loading, errors)

goal: make it look like a real app, but no new behavior.

scope:
	•	apply tailwind classes per spec to:
	•	ShellLayout grid, sidebar, main, bottom.
	•	ControlPanel (cards, sliders, button).
	•	ClusterGrid / ClusterCard / TrackTile.
	•	error banner + loading indicators.
	•	optional tiny UX tweaks:
	•	show session.status and session.errorMessage in ControlPanel.
	•	add small spinner icon to generate / more-like buttons when loading.

tests:
	•	mostly snapshot/DOM sanity checks:
	•	ensure error message text appears when errorMessage set.
	•	ensure “generating…” text when status="loading" and no clusters.

what NOT to do:
	•	no new API calls.
	•	no extra flows.
