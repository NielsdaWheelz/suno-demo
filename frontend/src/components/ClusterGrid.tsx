// /src/components/ClusterGrid.tsx
import React from "react";
import type { ClusterView, SessionStatus } from "../types/ui";
import { ClusterCard } from "./ClusterCard";

export interface ClusterGridProps {
  clusters: ClusterView[];
  sessionId: string | null;
  status: SessionStatus;
  loadingClusterId?: string;
  numClips: number;
  onMoreLike: (clusterId: string) => void;
}

export function ClusterGrid(props: ClusterGridProps): JSX.Element {
  const { clusters, sessionId, status, loadingClusterId, onMoreLike } = props;

  if (status === "loading" && clusters.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        <div className="inline-flex items-center gap-2">
          <svg
            className="h-4 w-4 animate-spin text-slate-300"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>Generating...</span>
        </div>
      </div>
    );
  }

  if (status === "idle" && clusters.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-500">No results yet</div>;
  }

  return (
    <div className="flex-1">
      <div className="mt-2 grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {clusters.map((cluster) => {
        const disabled = status === "loading" || loadingClusterId === cluster.id || !sessionId;

        return (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            disabled={disabled}
            onMoreLike={onMoreLike}
          />
        );
      })}
      </div>
    </div>
  );
}
