import { useEffect, useRef, type ReactElement } from "react";
import { useAudioVisualizer } from "../hooks/useAudioVisualizer";
import { resolveApiUrl } from "../api/client";
import { usePlayer } from "../player/PlayerContext";

export function BottomPlayer(): ReactElement {
  const { currentTrack } = usePlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shortId = currentTrack?.track.id.slice(0, 8);

  useAudioVisualizer(audioRef, canvasRef);

  useEffect(() => {
    if (!currentTrack) return;
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    el.load();

    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error("audio play failed", err);
      });
    }
  }, [currentTrack]);

  if (!currentTrack) {
    return (
      <div className="flex items-center gap-4 border-t border-slate-800 bg-slate-950/95 px-4 py-3">
        <div className="text-sm text-slate-400">player idle - select a track to preview</div>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-slate-950 border-t border-slate-800 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-70 pointer-events-none"
      />
      <div className="relative z-10 h-full flex items-center justify-between gap-4 px-4">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            now playing
          </span>
          <span className="text-sm font-medium text-slate-100 truncate">
            {currentTrack.clusterLabel}
          </span>
          {shortId ? <span className="text-xs text-slate-500">{shortId}</span> : null}
        </div>

        <audio
          ref={audioRef}
          crossOrigin="anonymous"
          controls
          autoPlay
          src={resolveApiUrl(currentTrack.track.audio_url)}
          className="w-64 max-w-full"
        />
      </div>
    </div>
  );
}
