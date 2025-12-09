// /src/components/ClusterCard.tsx
import React from "react";
import type { TrackOut } from "../types/api";
import type { ClusterView } from "../types/ui";
import { TrackTile } from "./TrackTile";

export interface ClusterCardProps {
  cluster: ClusterView;
  disabled: boolean;
  onMoreLike: (clusterId: string) => void;
  onTrackSelect: (track: TrackOut, clusterLabel: string) => void;
}

export function ClusterCard(props: ClusterCardProps): JSX.Element {
  const { cluster, disabled, onMoreLike, onTrackSelect } = props;
  const parentLabel = cluster.parentClusterId
    ? `from ${cluster.parentClusterId.slice(0, 8)}`
    : null;

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-base font-semibold text-slate-900">{cluster.label}</div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
              {cluster.source}
            </span>
            {parentLabel ? <span className="text-slate-500">{parentLabel}</span> : null}
          </div>
        </div>
        <button
          type="button"
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          onClick={() => onMoreLike(cluster.id)}
          disabled={disabled}
        >
          More like this
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {cluster.tracks.map((track) => (
          <TrackTile
            key={track.id}
            track={track}
            clusterLabel={cluster.label}
            onSelect={onTrackSelect}
          />
        ))}
      </div>
    </div>
  );
}
