1. goal & constraints

goal:
add an audio-reactive radial bars visualizer to the bottom player that:
	•	responds in real time to whichever track is currently playing
	•	is eye-catching but not insane to implement
	•	has zero backend impact
	•	doesn’t break if audio fails / is paused / changed

constraints:
	•	only use browser Web Audio API from the frontend.
	•	visualizer is purely decorative: no changes to audio behavior, just drawing.
	•	code must be self-contained: a single hook (useAudioVisualizer) and minimal changes to BottomPlayer.
	•	if the visualizer fails (no Web Audio, user blocks autoplay, etc.), the audio player must still work.

⸻

2. high-level architecture
	•	BottomPlayer continues to render:
	•	the <audio> element (single source of truth)
	•	track label, etc.
	•	new pieces:
	•	<canvas> layered under/behind the controls in the bottom bar
	•	useAudioVisualizer(audioRef, canvasRef) hook:
	•	creates & manages AudioContext, AnalyserNode, and animation loop
	•	connects the <audio> element to the analyser
	•	draws radial frequency bars at ~60fps

no global state changes. no provider changes.

⸻

3. types & functions

3.1 hook: useAudioVisualizer

file: src/hooks/useAudioVisualizer.ts

signature:

import { RefObject } from "react";

export interface AudioVisualizerOptions {
  fftSize?: number;                // default 256
  smoothingTimeConstant?: number;  // default 0.8
  minDecibels?: number;            // default -90
  maxDecibels?: number;            // default -10
}

export function useAudioVisualizer(
  audioRef: RefObject<HTMLAudioElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options?: AudioVisualizerOptions,
): void;

behavior:
	•	internally manages:

type VisualizerState = {
  audioContext: AudioContext | null;
  sourceNode: MediaElementAudioSourceNode | null;
  analyserNode: AnalyserNode | null;
  animationFrameId: number | null;
  dataArray: Uint8Array | null;
};


	•	on first “eligible” run (see below), it:
	1.	creates a single AudioContext (lazy, not on initial render).
	2.	creates a MediaElementAudioSourceNode from audioRef.current.
	3.	creates an AnalyserNode with:
	•	fftSize = options.fftSize ?? 256
	•	smoothingTimeConstant = options.smoothingTimeConstant ?? 0.8
	•	minDecibels = options.minDecibels ?? -90
	•	maxDecibels = options.maxDecibels ?? -10
	4.	allocates a Uint8Array of length analyser.frequencyBinCount.
	5.	starts a requestAnimationFrame loop that:
	•	calls analyser.getByteFrequencyData(dataArray)
	•	clears the canvas
	•	draws radial bars based on dataArray
	•	eligibility rules:
	•	if audioRef.current is null → do nothing.
	•	if canvasRef.current is null → do nothing.
	•	if AudioContext is not available (window.AudioContext / webkitAudioContext missing) → do nothing (fail silently, audio still works).
	•	if the hook runs again with the same audioRef.current and existing AudioContext, reuse them (no new contexts).
	•	cleanup:
	•	on unmount:
	•	cancel animation frame if set
	•	optionally do not call audioContext.close() (keeps it simple; closing is optional and can be omitted to avoid issues resuming)
	•	if audioRef.current changes (new <audio> element), disconnect old sourceNode and create a new one wired to the same analyser.

⸻

3.2 radial bars drawing algorithm

drawing happens inside the animation loop in useAudioVisualizer.

input:
	•	dataArray: Uint8Array with length N = analyser.frequencyBinCount
	•	each element in [0, 255] representing frequency magnitude

canvas setup:
	•	canvas width/height: always match display size; handle resize by checking clientWidth/clientHeight and resizing canvas.width / canvas.height accordingly each frame if changed.
	•	center:

const width = canvas.width;
const height = canvas.height;
const cx = width / 2;
const cy = height / 2;
const radiusBase = Math.min(width, height) * 0.25; // inner radius
const radiusMax = Math.min(width, height) * 0.45;  // outer radius



bars:
	•	choose numBars = 64 (downsample dataArray to 64 points).
	•	for i in [0, numBars):

const angle = (i / numBars) * 2 * Math.PI;      // around circle
const idx = Math.floor((i / numBars) * N);      // map to data index
const magnitude = dataArray[idx] / 255;         // 0..1
const barLength = radiusBase + magnitude * (radiusMax - radiusBase);


	•	each bar is a line from radiusBase to barLength at that angle:

const x0 = cx + radiusBase * Math.cos(angle);
const y0 = cy + radiusBase * Math.sin(angle);
const x1 = cx + barLength * Math.cos(angle);
const y1 = cy + barLength * Math.sin(angle);


	•	draw with:

ctx.strokeStyle = "rgba(56, 189, 248, 0.9)"; // sky-400-ish
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(x0, y0);
ctx.lineTo(x1, y1);
ctx.stroke();



background:
	•	clear each frame with a dark translucency so it trails slightly:

ctx.fillStyle = "rgba(15, 23, 42, 0.9)"; // slate-900-like
ctx.fillRect(0, 0, width, height);



⸻

4. BottomPlayer changes

file: src/components/BottomPlayer.tsx

current expected shape (roughly):

export function BottomPlayer(): JSX.Element {
  const { currentTrack } = usePlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!currentTrack) {
    return <div>select a track...</div>;
  }

  return (
    <div className="...">
      <div>{currentTrack.clusterLabel}</div>
      <audio ref={audioRef} controls src={currentTrack.track.audio_url} />
    </div>
  );
}

modifications
	1.	add canvasRef and hook:

const audioRef = useRef<HTMLAudioElement | null>(null);
const canvasRef = useRef<HTMLCanvasElement | null>(null);

useAudioVisualizer(audioRef, canvasRef);

	2.	wrap markup to layer canvas under content:

if (!currentTrack) {
  return (
    <div className="h-full flex items-center justify-between px-4 bg-slate-950 border-t border-slate-800 text-sm text-slate-400">
      <span>no track selected</span>
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
      </div>
      <audio
        ref={audioRef}
        controls
        src={currentTrack.track.audio_url}
        className="w-64 max-w-full"
      />
    </div>
  </div>
);

no other behavior changes. no new props.

⸻

5. failure modes & edge cases

useAudioVisualizer must handle:
	•	audioRef.current undefined initially: do nothing until it’s set.
	•	canvasRef.current undefined: do nothing until set.
	•	AudioContext not available: simply bail early, no errors.
	•	track changes:
	•	if audioRef.current changes (new element), detach old source, attach new.
	•	pausing audio:
	•	visualizer still runs; bars will tend toward low values. this is acceptable for now.

no exceptions thrown into React; errors should be caught inside the hook and logged at most.

⸻

6. tests

you’re not going to unit-test canvas drawing in detail; that’s overkill. but you should test the wiring and resilience.

6.1 useAudioVisualizer basic behavior

file: src/hooks/__tests__/useAudioVisualizer.test.tsx
	•	mock window.AudioContext with a fake that tracks:
	•	createAnalyser calls
	•	createMediaElementSource calls
	•	render a test component that:
	•	creates refs
	•	renders <audio ref={audioRef} /> and <canvas ref={canvasRef} />
	•	calls useAudioVisualizer(audioRef, canvasRef)

assert:
	•	that AudioContext is constructed once
	•	that createMediaElementSource is called when both refs are non-null
	•	that createAnalyser is called with correct config values

you can mock requestAnimationFrame to avoid an infinite loop; just ensure the code doesn’t throw.

6.2 BottomPlayer rendering

file: src/components/__tests__/BottomPlayer.visualizer.test.tsx
	•	when currentTrack is undefined:
	•	no <canvas> or <audio> rendered
	•	when currentTrack is present:
	•	<canvas> and <audio> are rendered
	•	useAudioVisualizer is called (mock it to assert call)

⸻

7. PR scope summary

PR title: “Add radial bars audio visualizer to BottomPlayer”

in-scope:
	•	new useAudioVisualizer hook
	•	Web Audio + canvas-based radial bars rendering
	•	BottomPlayer ref wiring and layout changes
	•	minimal tests for hook wiring and BottomPlayer

out-of-scope:
	•	any backend changes
	•	any additional visual modes
	•	any changes to PlayerProvider or other components
	•	any new config toggles (visualizer is always on if browser supports Web Audio)
