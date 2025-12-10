import type { ClusterView } from "../types/ui";
import type { ReactElement } from "react";

export interface ClusterTrailBarProps {
  clusters: ClusterView[];
  activeClusterId?: string;
  onSelectCluster: (clusterId: string | undefined) => void;
}

function computeTrail(clusters: ClusterView[], activeClusterId?: string): ClusterView[] {
  if (!activeClusterId) return [];

  const byId = new Map(clusters.map((c) => [c.id, c]));
  const trail: ClusterView[] = [];
  let current = byId.get(activeClusterId) ?? null;

  while (current) {
    trail.push(current);
    const parentId = current.parentClusterId;
    if (!parentId) break;
    current = byId.get(parentId) ?? null;
  }

  return trail.reverse();
}

export function ClusterTrailBar(props: ClusterTrailBarProps): ReactElement {
  const { clusters, activeClusterId, onSelectCluster } = props;
  const trail = computeTrail(clusters, activeClusterId);

  if (trail.length === 0) {
    return (
      <div className="flex items-center text-xs text-slate-400" role="status">
        no active branch yet
      </div>
    );
  }

  const baseChip =
    "inline-flex items-center px-2 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer";

  return (
    <div className="flex items-center gap-2 text-xs text-slate-300">
      <button
        type="button"
        className={`${baseChip} border-slate-700 text-slate-200`}
        onClick={() => onSelectCluster(undefined)}
      >
        All
      </button>
      {trail.map((cluster, index) => {
        const isLast = index === trail.length - 1;
        const chipClasses = isLast ? `${baseChip} border-sky-500 text-sky-300` : baseChip;

        return (
          <div key={cluster.id} className="flex items-center gap-2">
            <button
              type="button"
              className={chipClasses}
              onClick={() => onSelectCluster(cluster.id)}
            >
              {cluster.label}
            </button>
            {index < trail.length - 1 ? <span className="text-slate-500">&rarr;</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export { computeTrail };
