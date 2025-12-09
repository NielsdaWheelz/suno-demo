0. spec deltas (what is changing conceptually)

a) branching / trail with active branch highlight (frontend)
	•	new notion: an “active cluster” and its ancestry trail.
	•	SessionState gains:

export type SessionState = {
  sessionId: string | null;
  clusters: ClusterView[];
  status: SessionStatus;
  loadingClusterId?: string;
  errorMessage?: string;
  activeClusterId?: string; // NEW
};


	•	trail definition:
starting from activeClusterId, repeatedly follow parentClusterId back until undefined.
that ordered list of clusters is the “trail”.
	•	UI:
	•	right pane (generations) gets a TrailBar at top: clickable breadcrumb-like chips.
	•	all clusters still rendered in grid; those on the trail are visually highlighted; the active one is visually strongest.

b) better variety in cluster labels (backend only)
	•	no interface change. we still have:

class ClusterNamingProvider(Protocol):
    def name_cluster(self, prompts: List[str]) -> str: ...


	•	change is entirely inside OpenAiClusterNamingProvider:
	•	LLM prompt now tells model to produce vivid, non-generic, varied names.
	•	we can internally ask for multiple options and pick one, but we still return a single string.
	•	we do not touch fake providers, domain models, or HTTP contracts.

c) centralized playback (frontend)
	•	remove inline <audio> in TrackTile.
	•	single <audio> in BottomPlayer that plays the current track.
	•	introduce PlayerContext:

type PlayerContextValue = {
  currentTrack?: { track: TrackOut; clusterLabel: string };
  playTrack: (track: TrackOut, clusterLabel: string) => void;
};


	•	TrackTile gets a “Play” button that calls playTrack.
	•	BottomPlayer subscribes to context and renders the <audio>.

d) split main panel: left controls / right generations (frontend)
	•	MainPanel layout switches from vertical stack to 2 columns:
	•	left: ControlPanel
	•	right: TrailBar + ClusterGrid

⸻

PR 1 — Main panel layout split (controls left, generations right)

goal: change only layout; no new state or behavior.

scope
	•	modify MainPanel to accept explicit left and right children.

types & signatures

src/components/MainPanel.tsx:

export interface MainPanelProps {
  left: React.ReactNode;   // control panel
  right: React.ReactNode;  // generations pane
}

export function MainPanel({ left, right }: MainPanelProps): JSX.Element {
  // grid layout: [controls | generations]
}

requirements
	•	implement 2-column grid:

<div className="h-full grid grid-cols-[minmax(260px,340px)_1fr] gap-4 p-4">
  <div className="overflow-y-auto">{left}</div>
  <div className="overflow-y-auto">{right}</div>
</div>


	•	remove any previous “control on top, grid below” layout.
	•	App.tsx must be updated to pass:

<MainPanel
  left={<ControlPanel ... />}
  right={<ClusterGrid ... />}
/>


	•	no change to ControlPanel / ClusterGrid props.

tests
	•	MainPanel.test.tsx:
	•	renders left and right children in distinct containers.
	•	ensure DOM order is left then right.
	•	basic snapshot or class assertion that grid has 2 columns.

out of scope
	•	no change to SessionState, TrailBar, branching, player, or API.
	•	no styling beyond the above layout classes.

⸻

PR 2 — Centralized playback (PlayerContext, remove inline audio)

goal: there is exactly one <audio> element, in BottomPlayer. Track tiles only trigger playback via context.

scope
	1.	introduce PlayerContext + provider.
	2.	refactor BottomPlayer to use context.
	3.	refactor TrackTile to use playTrack instead of inline audio and “send to player”.
	4.	adjust App to wrap in provider.

types & signatures

src/player/PlayerContext.tsx (new):

import React from "react";
import type { TrackOut } from "../types/api";

export type PlayerContextValue = {
  currentTrack?: { track: TrackOut; clusterLabel: string };
  playTrack: (track: TrackOut, clusterLabel: string) => void;
};

export const PlayerContext = React.createContext<PlayerContextValue | undefined>(
  undefined,
);

export function usePlayer(): PlayerContextValue {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return ctx;
}

export interface PlayerProviderProps {
  children: React.ReactNode;
}

export function PlayerProvider({ children }: PlayerProviderProps): JSX.Element {
  const [currentTrack, setCurrentTrack] = React.useState<
    { track: TrackOut; clusterLabel: string } | undefined
  >(undefined);

  const playTrack = React.useCallback(
    (track: TrackOut, clusterLabel: string) => {
      setCurrentTrack({ track, clusterLabel });
    },
    [],
  );

  const value: PlayerContextValue = { currentTrack, playTrack };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

src/components/BottomPlayer.tsx (change signature and impl):
	•	new signature:

import { usePlayer } from "../player/PlayerContext";

export function BottomPlayer(): JSX.Element {
  const { currentTrack } = usePlayer();
  // ...
}


	•	behavior:
	•	if !currentTrack: show idle text, no <audio>.
	•	else: show label + single <audio controls src={currentTrack.track.audio_url}>.

src/components/TrackTile.tsx:
	•	change props:

export interface TrackTileProps {
  track: TrackOut;
  clusterLabel: string;
}


	•	remove onSelect.
	•	inside component:

const { playTrack } = usePlayer();

const handlePlayClick = () => playTrack(track, clusterLabel);


	•	UI: show a “Play” button (or icon) that calls handlePlayClick. no inline <audio>.

App.tsx:
	•	wrap the whole app (or at least ShellLayout) with PlayerProvider:

import { PlayerProvider } from "./player/PlayerContext";

export function App() {
  return (
    <PlayerProvider>
      <ShellLayout ... />
    </PlayerProvider>
  );
}


	•	stop passing any currentTrack/onTrackSelect props; ClusterGrid/ClusterCard/TrackTile rely on usePlayer.

tests
	•	PlayerContext.test.tsx:
	•	using a test component inside PlayerProvider, call playTrack and assert currentTrack updates (via render output).
	•	BottomPlayer.test.tsx:
	•	when currentTrack undefined → idle text, no <audio>.
	•	when context has a track → <audio> rendered with correct src.
	•	TrackTile.test.tsx:
	•	clicking “Play” calls playTrack (mock the hook or use test provider).

out of scope
	•	do not keep any inline <audio> elements anywhere else.
	•	no queue, no pause-other-tracks logic; browser handles overlapping playback if user clicks play multiple times.

⸻

PR 3 — Branch trail: active cluster + breadcrumb + highlight

goal: add an “active cluster” and display its ancestry trail; visually highlight clusters on that trail. All clusters still visible.

scope
	1.	extend SessionState with activeClusterId.
	2.	maintain activeClusterId in App:
	•	on createSession success: active cluster = first cluster of initial batch (or undefined if none).
	•	on moreLike success: active cluster = the new cluster created.
	3.	add a ClusterTrailBar component.
	4.	extend ClusterGrid to know which clusters are “on trail” and which is active.

types & signatures

src/types/ui.ts:

export type SessionState = {
  sessionId: string | null;
  clusters: ClusterView [];
  status: SessionStatus;
  loadingClusterId?: string;
  errorMessage?: string;
  activeClusterId?: string; // NEW
};

ClusterTrailBar (new): src/components/ClusterTrailBar.tsx

import type { ClusterView } from "../types/ui";

export interface ClusterTrailBarProps {
  clusters: ClusterView[];
  activeClusterId?: string;
  onSelectCluster: (clusterId: string | undefined) => void;
}

export function ClusterTrailBar(props: ClusterTrailBarProps): JSX.Element { ... }

behavior:
	•	compute trail as:

function computeTrail(
  clusters: ClusterView[],
  activeClusterId?: string,
): ClusterView[] {
  if (!activeClusterId) return [];
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const trail: ClusterView[] = [];
  let current = byId.get(activeClusterId);
  while (current) {
    trail.push(current);
    if (!current.parentClusterId) break;
    current = byId.get(current.parentClusterId);
  }
  return trail.reverse(); // root → ... → active
}


	•	render:
	•	if trail.length === 0: show “no active branch yet” or nothing.
	•	else: horizontally:

rootLabel → midLabel → activeLabel

each label is a button/chip. clicking:
	•	calls onSelectCluster(trailItem.id) for that cluster.
	•	support a “reset” (e.g. click on leftmost or explicit “all”) which calls onSelectCluster(undefined).

ClusterGrid signature change: add activeClusterId and boolean “on trail”:

export interface ClusterGridProps {
  clusters: ClusterView[];
  sessionId: string | null;
  status: SessionStatus;
  loadingClusterId?: string;
  numClips: number;
  activeClusterId?: string; // NEW
  onMoreLike: (clusterId: string) => void;
  onSelectCluster: (clusterId: string) => void;
}

behavior:
	•	for each cluster, compute:

const onTrailIds = new Set(trail.map((c) => c.id));
const isOnTrail = onTrailIds.has(cluster.id);
const isActive = cluster.id === activeClusterId;


	•	pass isOnTrail and isActive to ClusterCard via new props.

ClusterCard signature change:

export interface ClusterCardProps {
  cluster: ClusterView;
  disabled: boolean;
  isOnTrail: boolean;
  isActive: boolean;
  onMoreLike: (clusterId: string) => void;
  onTrackPlay: (track: TrackOut, clusterLabel: string) => void; // or use context directly
  onSelectCluster: (clusterId: string) => void;
}

behavior/UI:
	•	apply different styles:
	•	base: card border border-slate-800.
	•	if isOnTrail true: border-sky-700.
	•	if isActive true: border-sky-400 + maybe subtle background.
	•	clicking the card header or a “focus” icon calls onSelectCluster(cluster.id).

App.tsx logic changes:
	•	on createSession success:

const clusters = ...
const firstClusterId = clusters[0]?.id;
setSession({
  ...,
  activeClusterId: firstClusterId,
});


	•	on moreLike success:

const newCluster = ...
setSession(prev => ({
  ...,
  sessionId: data.session_id,
  clusters: [...prev.clusters, newCluster],
  status: "idle",
  loadingClusterId: undefined,
  errorMessage: undefined,
  activeClusterId: newCluster.id,
}));


	•	add handler:

const handleSelectCluster = (clusterId: string | undefined) => {
  setSession(prev => ({ ...prev, activeClusterId: clusterId }));
};


	•	MainPanel right prop now composes:

right={
  <div className="flex flex-col gap-3 h-full">
    <ClusterTrailBar
      clusters={session.clusters}
      activeClusterId={session.activeClusterId}
      onSelectCluster={handleSelectCluster}
    />
    <ClusterGrid
      clusters={session.clusters}
      activeClusterId={session.activeClusterId}
      ...
      onSelectCluster={(id) => handleSelectCluster(id)}
    />
  </div>
}



tests
	•	ClusterTrailBar.test.tsx:
	•	given clusters with parents, and activeClusterId on a leaf, computeTrail (explicit or via behavior) yields correct ordering root→leaf.
	•	clicking a breadcrumb calls onSelectCluster with that cluster’s id.
	•	ClusterGrid.test.tsx:
	•	when activeClusterId set, clusters on trail get isOnTrail=true; others false.
	•	active cluster gets isActive=true.
	•	integration-ish: after moreLike success, activeClusterId becomes the new cluster id.

out of scope
	•	no filtering: all clusters remain visible.
	•	no hiding of off-branch clusters.

⸻

PR 4 — Cluster label variety via prompt tweak (backend)

goal: labels become more differentiated and vivid by tweaking the LLM prompt inside OpenAiClusterNamingProvider. No contract changes.

scope
	•	modify only openai_cluster_naming_provider.py (or equivalent module) and, optionally, its tests.
	•	keep interface:

class OpenAiClusterNamingProvider(ClusterNamingProvider):
    def name_cluster(self, prompts: List[str]) -> str:
        ...



behavior spec
	•	input: 1–3 raw prompts (same as now).
	•	LLM call:
	•	system message: instructs model to act as a creative naming assistant for music clusters.
	•	user message: includes the prompts and constraints:
	•	produce one label.
	•	1–3 words.
	•	ASCII only, no quotes, no punctuation.
	•	must be vivid and specific, avoiding generic terms like “ambient”, “electronic”, “chill”, etc., unless combined with more concrete imagery.
	•	optional internal behavior: provider may ask for multiple suggestions and pick the first or a random one, but the function still returns a single str.

concrete prompt sketch (you’d codify this in python strings):
	•	system:
You name clusters of AI-generated songs. Given short text prompts, you invent a short, vivid, distinctive label that helps users tell clusters apart.
	•	user:
Prompts:
	1.	“{p1}”
	2.	“{p2}” …
Rules:
	•	Return only 1 label.
	•	1–3 words, ASCII only, no punctuation or quotes.
	•	Avoid generic labels like “ambient”, “electronic”, “cinematic” on their own. Combine them with concrete imagery or mood.
	•	Make the label clearly distinct from other generic-sounding clusters.

(you don’t need to mention other labels since we’re not passing them in.)

tests
	•	test_openai_cluster_naming_provider.py:
	•	using a mocked OpenAI client, assert that:
	•	the messages include “Avoid generic labels” instructions.
	•	the provider still post-processes: trims, strips quotes, enforces ASCII (as before).

(no need for live LLM tests.)

out of scope
	•	no existing_labels parameter, no deduping logic yet.
	•	no change to fake providers.
