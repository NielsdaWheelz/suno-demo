import { useEffect, useRef, type RefObject } from "react";

export interface AudioVisualizerOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
}

type VisualizerState = {
  audioContext: AudioContext | null;
  sourceNode: MediaElementAudioSourceNode | null;
  analyserNode: AnalyserNode | null;
  animationFrameId: number | null;
  dataArray: Uint8Array | null;
  sourceElement: HTMLMediaElement | null;
  analyserConnected: boolean;
};

export function useAudioVisualizer(
  audioRef: RefObject<HTMLAudioElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options?: AudioVisualizerOptions,
): void {
  const stateRef = useRef<VisualizerState>({
    audioContext: null,
    sourceNode: null,
    analyserNode: null,
    animationFrameId: null,
    dataArray: null,
    sourceElement: null,
    analyserConnected: false,
  });

  useEffect(() => {
    const AudioContextClass =
      typeof window !== "undefined"
        ? (window.AudioContext || (window as typeof window & { webkitAudioContext?: AudioContext }).webkitAudioContext)
        : undefined;

    if (!AudioContextClass) {
      return;
    }

    const state = stateRef.current;

    if (!state.audioContext) {
      state.audioContext = new AudioContextClass();
    }

    if (!state.analyserNode) {
      state.analyserNode = state.audioContext.createAnalyser();
      state.analyserConnected = false;
    }

    const analyser = state.analyserNode;
    analyser.fftSize = options?.fftSize ?? 256;
    analyser.smoothingTimeConstant = options?.smoothingTimeConstant ?? 0.8;
    analyser.minDecibels = options?.minDecibels ?? -90;
    analyser.maxDecibels = options?.maxDecibels ?? -10;

    if (!state.analyserConnected) {
      analyser.connect(state.audioContext.destination);
      state.analyserConnected = true;
    }

    const render = () => {
      const audioEl = audioRef.current;
      const canvasEl = canvasRef.current;

      if (!audioEl || !canvasEl) {
        state.animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      if (state.sourceNode && state.sourceElement !== audioEl) {
        state.sourceNode.disconnect();
        state.sourceNode = null;
        state.sourceElement = null;
      }

      if (!state.sourceNode) {
        state.sourceNode = state.audioContext!.createMediaElementSource(audioEl);
        state.sourceElement = audioEl;
        state.sourceNode.connect(analyser);
      }

      if (state.audioContext?.state === "suspended") {
        state.audioContext.resume().catch(() => {});
      }

      const expectedLength = analyser.frequencyBinCount;
      if (!state.dataArray || state.dataArray.length !== expectedLength) {
        state.dataArray = new Uint8Array(expectedLength);
      }

      const ctx = canvasEl.getContext("2d");
      if (!ctx || !state.dataArray) {
        state.animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      let width = canvasEl.width;
      let height = canvasEl.height;

      const nextWidth = canvasEl.clientWidth || width || canvasEl.width;
      const nextHeight = canvasEl.clientHeight || height || canvasEl.height;

      if (nextWidth !== width || nextHeight !== height) {
        width = nextWidth;
        height = nextHeight;
        canvasEl.width = width;
        canvasEl.height = height;
      }

      const { dataArray } = state;
      analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(0, 0, width, height);

      const numBars = 64;
      const barWidth = width / numBars;
      const baselineY = height * 0.8;
      const barMaxHeight = height * 0.6;

      ctx.lineWidth = Math.max(2, barWidth * 0.6);

      for (let i = 0; i < numBars; i += 1) {
        const idx = Math.floor((i / numBars) * dataArray.length);
        const magnitude = dataArray[idx] / 255;
        const barHeight = magnitude * barMaxHeight;
        const xCenter = i * barWidth + barWidth / 2;
        const y0 = baselineY;
        const y1 = Math.max(0, baselineY - barHeight);
        const hue = 180 + magnitude * 120; // cyan to magenta range
        const lightness = 50 + magnitude * 20;
        ctx.strokeStyle = `hsl(${hue}, 85%, ${lightness}%)`;

        ctx.beginPath();
        ctx.moveTo(xCenter, y0);
        ctx.lineTo(xCenter, y1);
        ctx.stroke();
      }

      state.animationFrameId = window.requestAnimationFrame(render);
    };

    state.animationFrameId = window.requestAnimationFrame(render);

    return () => {
      if (state.animationFrameId !== null) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
      }
    };
  }, [
    audioRef,
    canvasRef,
    options?.fftSize,
    options?.smoothingTimeConstant,
    options?.minDecibels,
    options?.maxDecibels,
  ]);
}
