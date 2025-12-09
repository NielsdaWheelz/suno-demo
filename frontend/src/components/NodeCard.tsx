import type { NodeView } from "../types/ui";

export interface NodeCardProps {
  node: NodeView;
  selected?: boolean;
  disabled?: boolean;
  onMoreLike: (node: NodeView) => void;
  onPlay: (node: NodeView) => void;
  onSelect: (node: NodeView) => void;
}

export function NodeCard({
  node,
  selected,
  disabled,
  onMoreLike,
  onPlay,
  onSelect,
}: NodeCardProps) {
  const borderClass = selected ? "border-sky-500" : "border-slate-800";
  const bgClass = selected ? "bg-slate-800" : "bg-slate-900";

  return (
    <div
      data-testid={`node-card-${node.id}`}
      className={`rounded-lg border ${borderClass} ${bgClass} p-3 flex flex-col gap-2 transition-colors`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-100 truncate">{node.label}</div>
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
          onClick={() => {
            onSelect(node);
            onPlay(node);
          }}
          className="text-xs px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={disabled}
        >
          play
        </button>

        <button
          type="button"
          onClick={() => {
            onSelect(node);
            onMoreLike(node);
          }}
          className="text-xs px-2 py-1 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
          disabled={disabled}
        >
          {disabled ? (
            <>
              <svg
                className="h-3 w-3 animate-spin text-slate-200"
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
              <span>generating...</span>
            </>
          ) : (
            "more like this"
          )}
        </button>
      </div>
    </div>
  );
}
