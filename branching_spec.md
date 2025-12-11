spec: node-based branching viz (frontend-only)

high-level behavior
	•	backend stays unchanged:
	•	CreateSessionResponse.batch.clusters: ClusterOut[]
	•	ClusterOut.tracks: TrackOut[]
	•	MoreLikeResponse.batch.clusters (exactly one) with tracks.
	•	frontend now thinks in terms of nodes, not clusters:
	•	a Node = one track + a label + generation index + lineage.
	•	initial generation (POST /sessions) produces:
	•	3 nodes with generationIndex = 0.
	•	each “More like this” from any node:
	•	calls moreLikeCluster(sessionId, node.backendClusterId, { num_clips: 3 }).
	•	response yields 3 new nodes.
	•	those 3 nodes share:
	•	generationIndex = previousMaxGenerationIndex + 1
	•	parentNodeId = id of the node you clicked from
	•	UI shows:
	•	each generation as one row with up to 3 cards.
	•	every card is a full “node card”: label, play button, “more like this”.
	•	lines are drawn between each node and its parent (SVG overlay).

no more numClips control in the UI; always 3.

⸻

types and state changes

1. new NodeView type (frontend only)

file: src/types/ui.ts

add:

import type { TrackOut } from "./api";

export type NodeId = string;

export type NodeView = {
  id: NodeId;               // unique per node; use track.id
  track: TrackOut;          // underlying audio
  label: string;            // cluster label from backend
  generationIndex: number;  // 0 for initial batch, 1,2,... for later gens
  parentNodeId?: NodeId;    // which node spawned this one (undefined for initial)
  backendClusterId: string; // cluster id used for moreLikeCluster()
};

2. SessionState becomes node-centric

replace the cluster–centric shape in SessionState with nodes:

export type SessionState = {
  sessionId: string | null;
  nodes: NodeView[];        // was clusters[]
  status: SessionStatus;
  errorMessage?: string;
  // keep if needed:
  loadingClusterId?: string;   // can re-interpret as “loadingNodeId” or drop
  nextGenerationIndex: number; // NEW: tracks next row index
  selectedNodeId?: NodeId;     // current focus for play/highlight
};

explicit rules:
	•	initial state:

{
  sessionId: null,
  nodes: [],
  status: "idle",
  errorMessage: undefined,
  nextGenerationIndex: 0,
}


	•	after first createSession success:
	•	nextGenerationIndex is set to 1 (since we just used 0).
	•	after each moreLike success:
	•	nextGenerationIndex increments by 1.

if you want to keep trail-related fields (activeClusterId, loadingClusterId) you can, but they’re not required for this spec. simplest is to delete them and reduce state.

⸻

mapping responses to nodes

we want pure functions to keep the logic clean and testable.

3. mapping helpers

file: src/logic/nodes.ts (new)

import type { BatchOut, ClusterOut, TrackOut } from "../types/api";
import type { NodeView, NodeId } from "../types/ui";

/**
 * Flatten an initial batch into NodeView[] with generationIndex=0 and no parents.
 * - each track in each cluster becomes one NodeView
 * - id = track.id
 * - backendClusterId = cluster.id
 */
export function nodesFromInitialBatch(batch: BatchOut): NodeView[] {
  const result: NodeView[] = [];
  const generationIndex = 0;

  for (const cluster of batch.clusters) {
    for (const track of cluster.tracks) {
      result.push({
        id: track.id,
        track,
        label: cluster.label,
        generationIndex,
        parentNodeId: undefined,
        backendClusterId: cluster.id,
      });
    }
  }

  return result;
}

/**
 * Flatten a moreLikeCluster result into NodeView[].
 * - expects exactly 1 cluster in batch
 * - generationIndex is provided by caller
 * - parentNodeId is the node that triggered more-like
 */
export function nodesFromMoreLike(
  batch: BatchOut,
  generationIndex: number,
  parentNodeId: NodeId,
): NodeView[] {
  if (batch.clusters.length !== 1) {
    // defensive: if backend ever changes, we fail loudly
    throw new Error(`Expected exactly 1 cluster in moreLike batch, got ${batch.clusters.length}`);
  }
  const cluster: ClusterOut = batch.clusters[0];
  const result: NodeView[] = [];

  for (const track of cluster.tracks) {
    result.push({
      id: track.id,
      track,
      label: cluster.label,
      generationIndex,
      parentNodeId,
      backendClusterId: cluster.id,
    });
  }

  return result;
}

invariants:
	•	NodeView.id is exactly track.id.
	•	generationIndex for initial nodes is always 0.
	•	nodesFromMoreLike uses whatever generationIndex the caller passes (must be session.nextGenerationIndex at call time).
	•	parentNodeId is always set on more-like nodes, never on initial nodes.

⸻

UI changes

4. fixed num_clips = 3, remove UI control

remove numClips from:
	•	ControlPanelState
	•	ControlPanelProps
	•	ClusterGridProps (if it references numClips)
	•	ControlPanel UI (input for number of clips)

instead, define in App.tsx:

const NUM_CLIPS = 3;

and use it:
	•	in handleGenerate:

const body: CreateSessionRequest = {
  brief: controls.brief,
  num_clips: NUM_CLIPS,
  params: controls.params,
};


	•	in handleMoreLike (see below):

moreLikeMutation.mutate({
  sessionId: session.sessionId!,
  clusterId: node.backendClusterId,
  numClips: NUM_CLIPS,
});



API contract stays the same; user just can’t change the value.

5. node-centric grid layout (rows of 3, one row per generation)

replace ClusterGrid semantics with NodeGrid.

file: src/components/NodeGrid.tsx (new)

import type { NodeView } from "../types/ui";

export interface NodeGridProps {
  nodes: NodeView[];
  status: SessionStatus;
  onMoreLike: (node: NodeView) => void;
  onPlay: (node: NodeView) => void; // or rely on PlayerContext directly
}

export function NodeGrid(props: NodeGridProps): JSX.Element { ... }

behavior:
	•	group nodes by generationIndex:

const generations = new Map<number, NodeView[]>();
for (const node of nodes) {
  const list = generations.get(node.generationIndex) ?? [];
  list.push(node);
  generations.set(node.generationIndex, list);
}
const sortedGenerations = Array.from(generations.entries())
  .sort(([a], [b]) => a - b); // 0,1,2,...


	•	render each generation as a row:

return (
  <div className="flex flex-col gap-4">
    {status === "loading" && nodes.length === 0 && (
      <div className="text-sm text-slate-400">generating...</div>
    )}

    {status === "idle" && nodes.length === 0 && (
      <div className="text-sm text-slate-500">no results yet</div>
    )}

    {sortedGenerations.map(([generationIndex, genNodes]) => (
      <div key={generationIndex} className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          generation {generationIndex}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {genNodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onMoreLike={onMoreLike}
              onPlay={onPlay}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
);



file: src/components/NodeCard.tsx (new)

import type { NodeView } from "../types/ui";

export interface NodeCardProps {
  node: NodeView;
  onMoreLike: (node: NodeView) => void;
  onPlay: (node: NodeView) => void;
}

export function NodeCard({ node, onMoreLike, onPlay }: NodeCardProps): JSX.Element {
  const handleMoreClick = () => onMoreLike(node);
  const handlePlayClick = () => onPlay(node);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-100 truncate">
          {node.label}
        </div>
        {node.parentNodeId && (
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            from {node.parentNodeId.slice(0, 6)}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        ~{Math.round(node.track.duration_sec)}s · {node.id.slice(0, 8)}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handlePlayClick}
          className="text-xs px-2 py-1 rounded bg-sky-700 hover:bg-sky-600"
        >
          play
        </button>
        <button
          type="button"
          onClick={handleMoreClick}
          className="text-xs px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
        >
          more like this
        </button>
      </div>
    </div>
  );
}

note: if you already have PlayerContext wired, NodeCard can just call playTrack(node.track, node.label) inside handlePlayClick instead of passing onPlay down. BottomPlayer remains the single audio surface.

6. App wiring

in App.tsx:
	•	replace clusters references with nodes.
	•	createSession success:

onSuccess: (data) => {
  const initialNodes = nodesFromInitialBatch(data.batch);
  setSession({
    sessionId: data.session_id,
    nodes: initialNodes,
    status: "idle",
    errorMessage: undefined,
    nextGenerationIndex: 1, // initial generation was 0
  });
  // controls.loading = false etc.
}


	•	moreLike mutation:

const moreLikeMutation = useMutation({
  mutationFn: ({
    sessionId,
    clusterId,
  }: { sessionId: string; clusterId: string }) =>
    moreLikeCluster(sessionId, clusterId, { num_clips: NUM_CLIPS }),

  onMutate: ({ clusterId }) => {
    setSession((prev) => ({
      ...prev,
      status: "loading",
      errorMessage: undefined,
      // optionally, store loadingNodeId if you want per-node spinner later
    }));
  },

  onSuccess: (data, variables) => {
    setSession((prev) => {
      const parentNodeId = variables.nodeId; // see below
      const generationIndex = prev.nextGenerationIndex;
      const newNodes = nodesFromMoreLike(data.batch, generationIndex, parentNodeId);
      return {
        ...prev,
        sessionId: data.session_id,
        nodes: [...prev.nodes, ...newNodes],
        status: "idle",
        errorMessage: undefined,
        nextGenerationIndex: generationIndex + 1,
      };
    });
  },

  onError: (err) => {
    // set status="error", errorMessage, etc.
  },
});



you’ll want the mutation’s variables to include both clusterId and nodeId:

mutationFn: ({ sessionId, clusterId, nodeId }: { sessionId: string; clusterId: string; nodeId: string }) =>
  moreLikeCluster(sessionId, clusterId, { num_clips: NUM_CLIPS }),

and handleMoreLike becomes:

const handleMoreLike = (node: NodeView) => {
  if (!session.sessionId) return;
  moreLikeMutation.mutate({
    sessionId: session.sessionId,
    clusterId: node.backendClusterId,
    nodeId: node.id,
  });
};

MainPanel right side uses NodeGrid:

right={
  <NodeGrid
    nodes={session.nodes}
    status={session.status}
    onMoreLike={handleMoreLike}
    onPlay={(node) => playTrack(node.track, node.label)} // if using PlayerContext
  />
}


⸻

tests

you need tests for three things:

1. mapping helpers

file: src/logic/__tests__/nodes.test.ts
	•	nodesFromInitialBatch:
	•	given a BatchOut with 2 clusters and 3 tracks total, returns 3 nodes.
	•	all nodes have generationIndex === 0.
	•	each node’s backendClusterId matches its cluster.id.
	•	parentNodeId is undefined for all.
	•	nodesFromMoreLike:
	•	when batch.clusters.length === 1, returns N nodes with:
	•	provided generationIndex.
	•	parentNodeId === parentNodeId argument.
	•	when batch.clusters.length !== 1, throws.

2. NodeGrid layout

file: src/components/__tests__/NodeGrid.test.tsx
	•	given nodes with generationIndex {0,0,1,1,2}:
	•	rows are rendered in order 0,1,2 (you can assert on generation headings).
	•	each row shows the correct set of NodeCards (by id).
	•	when status="loading" and nodes.length === 0, shows “generating…”.
	•	when status="idle" and nodes.length === 0, shows “no results yet”.

3. App integration (happy path)

file: src/__tests__/App.nodes.test.tsx
	•	mock createSession to return a batch with known clusters/tracks:
	•	after clicking Generate, NodeGrid shows 3 cards in “generation 0”.
	•	mock moreLikeCluster to return one cluster with 3 tracks:
	•	click “more like this” on the first node.
	•	after success, NodeGrid shows rows:
	•	generation 0: 3 nodes
	•	generation 1: 3 nodes
	•	ensure new nodes have parentNodeId equal to the clicked node’s id.

⸻

PR summary

PR: “node-based branching grid & fixed 3-clip generations”

goal:
frontend only. replace cluster-based grid with node-based branching rows, and remove numClips control (always 3). backend untouched.

files touched / added:
	•	src/types/ui.ts — add NodeView, NodeId, update SessionState.
	•	src/logic/nodes.ts + tests — mapping helpers (nodesFromInitialBatch, nodesFromMoreLike).
	•	src/components/NodeGrid.tsx, NodeCard.tsx + tests — new node grid.
	•	src/components/ControlPanel.tsx — remove numClips input and props.
	•	src/App.tsx — change state and wiring (use nodes, mapping helpers, hardcode 3).
	•	any old ClusterGrid/ClusterCard code/tests — either removed or left unused (ideally removed in this PR).

out of scope:
	•	no backend changes.
	•	no changes to provider interfaces or labels.
