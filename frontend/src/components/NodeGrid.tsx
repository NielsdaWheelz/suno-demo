import { useLayoutEffect, useRef, useState } from "react";
import type { NodeId, NodeView } from "../types/ui";
import { NodeCard } from "./NodeCard";

type Line = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export interface NodeGridProps {
  nodes: NodeView[];
  status: "idle" | "loading" | "error";
  onMoreLike: (node: NodeView) => void;
  onPlay: (node: NodeView) => void;
  selectedNodeId?: NodeId;
  onSelect: (node: NodeView) => void;
}

export function NodeGrid({
  nodes,
  status,
  onMoreLike,
  onPlay,
  selectedNodeId,
  onSelect,
}: NodeGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<NodeId, HTMLDivElement>>(new Map());
  const [lines, setLines] = useState<Line[]>([]);

  const gens = new Map<number, NodeView[]>();
  for (const n of nodes) {
    const arr = gens.get(n.generationIndex) ?? [];
    arr.push(n);
    gens.set(n.generationIndex, arr);
  }

  const rows = [...gens.entries()].sort(([a], [b]) => a - b);

  const updateLines = () => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const newLines: Line[] = [];

    for (const node of nodes) {
      if (!node.parentNodeId) continue;
      const fromEl = nodeRefs.current.get(node.parentNodeId);
      const toEl = nodeRefs.current.get(node.id);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      newLines.push({
        from: {
          x: fromRect.left - containerRect.left + fromRect.width / 2,
          y: fromRect.top - containerRect.top + fromRect.height,
        },
        to: {
          x: toRect.left - containerRect.left + toRect.width / 2,
          y: toRect.top - containerRect.top,
        },
      });
    }

    setLines(newLines);
  };

  useLayoutEffect(() => {
    updateLines();
  }, [nodes]);

  useLayoutEffect(() => {
    const handle = () => updateLines();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const setNodeRef = (id: NodeId) => (el: HTMLDivElement | null) => {
    if (el) {
      nodeRefs.current.set(id, el);
    } else {
      nodeRefs.current.delete(id);
    }
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-4">
      <svg className="absolute inset-0 pointer-events-none w-full h-full" role="presentation">
        {lines.map((line, idx) => (
          <line
            key={idx}
            x1={line.from.x}
            y1={line.from.y}
            x2={line.to.x}
            y2={line.to.y}
            stroke="rgb(56 189 248)" // sky-400
            strokeWidth="2"
            strokeOpacity="0.6"
          />
        ))}
      </svg>

      {status === "loading" && nodes.length === 0 && (
        <div className="text-sm text-slate-400">generating...</div>
      )}

      {status === "idle" && nodes.length === 0 && (
        <div className="text-sm text-slate-500">no results yet</div>
      )}

      {rows.map(([gen, rowNodes]) => (
        <div key={gen} className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            generation {gen}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {rowNodes.map((node) => (
              <div key={node.id} ref={setNodeRef(node.id)}>
                <NodeCard
                  node={node}
                  selected={node.id === selectedNodeId}
                  disabled={status === "loading"}
                  onMoreLike={onMoreLike}
                  onPlay={onPlay}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
