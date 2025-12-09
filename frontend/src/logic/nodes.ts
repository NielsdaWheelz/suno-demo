import type { BatchOut, ClusterOut } from "../types/api";
import type { NodeId, NodeView } from "../types/ui";

export function nodesFromInitialBatch(batch: BatchOut): NodeView[] {
  const generationIndex = 0;
  const nodes: NodeView[] = [];

  for (const cluster of batch.clusters) {
    for (const track of cluster.tracks) {
      nodes.push({
        id: track.id,
        track,
        label: cluster.label,
        generationIndex,
        parentNodeId: undefined,
        backendClusterId: cluster.id,
      });
    }
  }

  return nodes;
}

export function nodesFromMoreLike(
  batch: BatchOut,
  generationIndex: number,
  parentNodeId: NodeId,
): NodeView[] {
  if (batch.clusters.length !== 1) {
    throw new Error(`Expected exactly 1 cluster in moreLike batch`);
  }

  const cluster: ClusterOut = batch.clusters[0];
  const nodes: NodeView[] = [];

  for (const track of cluster.tracks) {
    nodes.push({
      id: track.id,
      track,
      label: cluster.label,
      generationIndex,
      parentNodeId,
      backendClusterId: cluster.id,
    });
  }

  return nodes;
}
