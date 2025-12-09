import { useEffect, useRef, type JSX } from "react";
import { resolveApiUrl } from "../api/client";
import { usePlayer } from "../player/PlayerContext";

export function BottomPlayer(): JSX.Element {
  const { currentTrack } = usePlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shortId = currentTrack?.track.id.slice(0, 8);

  useEffect(() => {
    if (!currentTrack) return;
    const el = audioRef.current;
    if (!el) return;
    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }, [currentTrack]);

  return (
    <div className="flex items-center gap-4 border-t border-slate-800 bg-slate-950/95 px-4 py-3">
      {currentTrack ? (
        <>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-white">{currentTrack.clusterLabel}</div>
            {shortId ? <div className="text-xs text-slate-400">{shortId}</div> : null}
          </div>
          <audio
            ref={audioRef}
            controls
            autoPlay
            src={resolveApiUrl(currentTrack.track.audio_url)}
            className="w-full max-w-md"
          />
        </>
      ) : (
        <div className="text-sm text-slate-400">player idle - select a track to preview</div>
      )}
    </div>
  );
}
