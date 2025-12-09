import React from "react";

export interface BottomPlayerProps {
  currentTrack?: { trackId: string; label: string };
}

export function BottomPlayer(props: BottomPlayerProps): JSX.Element {
  const { currentTrack } = props;
  const shortId =
    currentTrack?.trackId.slice(0, 8) ?? undefined;

  return (
    <div className="flex h-[72px] items-center justify-between bg-slate-900 px-6 text-slate-100">
      {currentTrack ? (
        <div className="flex flex-col gap-1">
          <div className="text-sm text-slate-300">Now playing</div>
          <div className="text-base font-medium">
            {currentTrack.label}
            {shortId ? <span className="text-slate-400"> · {shortId}</span> : null}
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-300">select a track to preview</div>
      )}
      <div className="text-xs uppercase tracking-wide text-slate-500">
        placeholder
      </div>
    </div>
  );
}
