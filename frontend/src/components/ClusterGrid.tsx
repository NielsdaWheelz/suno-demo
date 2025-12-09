// /src/components/ClusterGrid.tsx
import React from "react";
import type { TrackOut } from "../types/api";
import type { ClusterView, SessionStatus } from "../types/ui";
import { ClusterCard } from "./ClusterCard";

export interface ClusterGridProps {
  clusters: ClusterView[];
  sessionId: string | null;
  status: SessionStatus;
  loadingClusterId?: string;
  numClips: number;
  onMoreLike: (clusterId: string) => void;
  onTrackSelect: (track: TrackOut, clusterLabel: string) => void;
}

export function ClusterGrid(props: ClusterGridProps): JSX.Element {
  const { clusters, sessionId, status, loadingClusterId, onMoreLike, onTrackSelect } = props;

  if (status === "loading" && clusters.length === 0) {
    return <div>generating…</div>;
  }

  if (status === "idle" && clusters.length === 0) {
    return <div>no results yet</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {clusters.map((cluster) => {
        const disabled = status === "loading" || loadingClusterId === cluster.id || !sessionId;

        return (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            disabled={disabled}
            onMoreLike={onMoreLike}
            onTrackSelect={onTrackSelect}
          />
        );
      })}
    </div>
  );
}
