// /src/components/TrackTile.tsx
import React from "react";
import { resolveApiUrl } from "../api/client";
import type { TrackOut } from "../types/api";

export interface TrackTileProps {
  track: TrackOut;
  clusterLabel: string;
  onSelect: (track: TrackOut, clusterLabel: string) => void;
}

export function TrackTile(props: TrackTileProps): JSX.Element {
  const { track, clusterLabel, onSelect } = props;
  const shortId = track.id.slice(0, 8);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
        <span className="truncate font-semibold text-slate-100">{shortId}</span>
        <span className="text-slate-500">{track.duration_sec}s</span>
      </div>
      <audio controls src={resolveApiUrl(track.audio_url)} className="w-full" />
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-100 transition hover:bg-slate-700"
        onClick={() => onSelect(track, clusterLabel)}
      >
        Send to player
      </button>
    </div>
  );
}
