// /src/components/TrackTile.tsx
import type { JSX } from "react";
import type { TrackOut } from "../types/api";
import { usePlayer } from "../player/PlayerContext";

export interface TrackTileProps {
  track: TrackOut;
  clusterLabel: string;
}

export function TrackTile(props: TrackTileProps): JSX.Element {
  const { track, clusterLabel } = props;
  const { playTrack } = usePlayer();
  const shortId = track.id.slice(0, 8);
  const truncatedDuration = Math.floor(track.duration_sec * 100) / 100;
  const durationLabel = `${truncatedDuration.toFixed(2)}s`;

  const handlePlayClick = () => {
    playTrack(track, clusterLabel);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
        <span className="truncate font-semibold text-slate-100">{shortId}</span>
        <button
          type="button"
          className=""
          onClick={handlePlayClick}
        >
          ▶
        </button>

        <span className="text-slate-500">{durationLabel}</span>
      </div>
    </div>
  );
}
