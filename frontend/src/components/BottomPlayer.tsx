import type { TrackOut } from "../types/api";

export interface BottomPlayerProps {
  currentTrack?: { track: TrackOut; clusterLabel: string };
}

export function BottomPlayer(props: BottomPlayerProps): JSX.Element {
  const { currentTrack } = props;
  const shortId = currentTrack?.track.id.slice(0, 8);

  return (
    <div className="flex h-[80px] items-center justify-between border-t border-slate-800 bg-slate-900 px-6 text-slate-100">
      {currentTrack ? (
        <>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-white">{currentTrack.clusterLabel}</div>
            {shortId ? <div className="text-xs text-slate-400">{shortId}</div> : null}
          </div>
          <audio
            controls
            src={currentTrack.track.audio_url}
            className="w-64 max-w-full"
          />
        </>
      ) : (
        <div className="text-sm text-slate-300">Select a track to preview</div>
      )}
    </div>
  );
}
