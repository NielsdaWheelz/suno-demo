import type { TrackOut } from "../types/api";

export interface BottomPlayerProps {
  currentTrack?: { track: TrackOut; clusterLabel: string };
}

export function BottomPlayer(props: BottomPlayerProps): JSX.Element {
  const { currentTrack } = props;
  const shortId = currentTrack?.track.id.slice(0, 8);

  return (
    <div className="flex items-center gap-4 border-t border-slate-800 bg-slate-950/95 px-4 py-3">
      {currentTrack ? (
        <>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-white">{currentTrack.clusterLabel}</div>
            {shortId ? <div className="text-xs text-slate-400">{shortId}</div> : null}
          </div>
          <audio
            controls
            src={currentTrack.track.audio_url}
            className="w-full max-w-md"
          />
        </>
      ) : (
        <div className="text-sm text-slate-400">select a track to preview</div>
      )}
    </div>
  );
}
