// /src/components/ClusterCard.tsx
import React from "react";
import type { ClusterView } from "../types/ui";
import { TrackTile } from "./TrackTile";

export interface ClusterCardProps {
  cluster: ClusterView;
  disabled: boolean;
  isOnTrail: boolean;
  isActive: boolean;
  onMoreLike: (clusterId: string) => void;
  onSelectCluster: (clusterId: string) => void;
}

export function ClusterCard(props: ClusterCardProps): JSX.Element {
  const { cluster, disabled, isOnTrail, isActive, onMoreLike, onSelectCluster } = props;
  const parentLabel = cluster.parentClusterId
    ? `from ${cluster.parentClusterId.slice(0, 8)}`
    : null;
  const buttonLabel = disabled ? "Generating..." : "More like this";
  const base = "rounded-lg border bg-slate-900 shadow-sm p-3 flex flex-col gap-3";
  const borderClass = isActive
    ? "border-sky-400"
    : isOnTrail
    ? "border-sky-700"
    : "border-slate-800";

  return (
    <div
      data-testid={`cluster-card-${cluster.id}`}
      className={`${base} ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onSelectCluster(cluster.id)}
            className="text-sm font-medium text-slate-50 hover:text-sky-300"
          >
            {cluster.label}
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 font-medium text-slate-200">
              {cluster.source}
            </span>
            {parentLabel ? <span className="text-slate-500">{parentLabel}</span> : null}
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onMoreLike(cluster.id)}
          disabled={disabled}
        >
          {buttonLabel}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {cluster.tracks.map((track) => (
          <TrackTile
            key={track.id}
            track={track}
            clusterLabel={cluster.label}
          />
        ))}
      </div>
    </div>
  );
}
