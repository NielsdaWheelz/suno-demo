// /src/components/TrackTile.tsx
import React from "react";
import type { TrackOut } from "../types/api";

export interface TrackTileProps {
  track: TrackOut;
  clusterLabel: string;
  onSelect: (track: TrackOut, clusterLabel: string) => void;
}

export function TrackTile(props: TrackTileProps): JSX.Element {
  const { track, clusterLabel, onSelect } = props;

  return (
    <div className="space-y-2 rounded-md border bg-white p-3 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">{track.id.slice(0, 8)}</div>
      <div className="text-xs text-slate-600">{`${track.duration_sec}s`}</div>
      <audio controls src={track.audio_url} className="w-full" />
      <button
        type="button"
        className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
        onClick={() => onSelect(track, clusterLabel)}
      >
        Select
      </button>
    </div>
  );
}
