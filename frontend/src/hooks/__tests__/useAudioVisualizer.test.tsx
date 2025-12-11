import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useRef } from "react";
import { useAudioVisualizer } from "../useAudioVisualizer";

class FakeAnalyserNode {
  fftSize = 0;
  smoothingTimeConstant = 0;
  minDecibels = 0;
  maxDecibels = 0;
  connect = vi.fn();

  get frequencyBinCount(): number {
    return this.fftSize / 2;
  }

  // eslint-disable-next-line class-methods-use-this
  getByteFrequencyData(array: Uint8Array): void {
    array.fill(0);
  }
}

class FakeMediaElementSourceNode {
  constructor(public element: HTMLMediaElement) {}
  connect = vi.fn();
  disconnect = vi.fn();
}

describe("useAudioVisualizer", () => {
  let createAnalyserMock: ReturnType<typeof vi.fn>;
  let createMediaElementSourceMock: ReturnType<typeof vi.fn>;
  let audioContextConstructorMock: ReturnType<typeof vi.fn>;
  let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>;
  let cancelAnimationFrameSpy: ReturnType<typeof vi.spyOn>;
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let resumeMock: ReturnType<typeof vi.fn>;
  let pauseSpy: ReturnType<typeof vi.spyOn>;
  let loadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createAnalyserMock = vi.fn(() => new FakeAnalyserNode());
    createMediaElementSourceMock = vi.fn((element: HTMLMediaElement) => new FakeMediaElementSourceNode(element));
    audioContextConstructorMock = vi.fn();
    resumeMock = vi.fn(() => Promise.resolve());

    class FakeAudioContext {
      state: AudioContextState = "running";
      destination = {};
      createAnalyser = createAnalyserMock;
      createMediaElementSource = createMediaElementSourceMock;
      resume = resumeMock;

      constructor() {
        audioContextConstructorMock();
      }
    }

    // @ts-expect-error assigning test doubles
    window.AudioContext = FakeAudioContext;
    // @ts-expect-error assigning test doubles
    window.webkitAudioContext = FakeAudioContext;

    const fakeCanvasContext = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };

    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeCanvasContext as unknown as CanvasRenderingContext2D);

    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    loadSpy = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});

    let rafCallCount = 0;
    requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCallCount += 1;
        if (rafCallCount < 3) {
          cb(0);
        }
        return rafCallCount;
      });
    cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error cleanup test doubles
    delete window.AudioContext;
    // @ts-expect-error cleanup test doubles
    delete window.webkitAudioContext;
    getContextSpy.mockRestore();
    pauseSpy.mockRestore();
    loadSpy.mockRestore();
  });

  it("does not throw when refs are null", () => {
    const TestComponent = () => {
      const audioRef = useRef<HTMLAudioElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      useAudioVisualizer(audioRef, canvasRef);
      return null;
    };

    expect(() => render(<TestComponent />)).not.toThrow();
  });

  it("constructs AudioContext, media source, analyser, and starts raf", () => {
    const TestComponent = () => {
      const audioRef = useRef<HTMLAudioElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      useAudioVisualizer(audioRef, canvasRef);
      return (
        <div>
          <audio ref={audioRef} />
          <canvas ref={canvasRef} />
        </div>
      );
    };

    const { container } = render(<TestComponent />);
    const audioEl = container.querySelector("audio") as HTMLAudioElement | null;
    const analyserInstance = createAnalyserMock.mock.results[0]?.value as FakeAnalyserNode | undefined;

    expect(audioContextConstructorMock).toHaveBeenCalledTimes(1);
    expect(createMediaElementSourceMock).toHaveBeenCalledTimes(1);
    expect(createMediaElementSourceMock).toHaveBeenCalledWith(audioEl);
    expect(createAnalyserMock).toHaveBeenCalledTimes(1);
    expect(analyserInstance?.fftSize).toBe(256);
    expect(analyserInstance?.smoothingTimeConstant).toBe(0.8);
    expect(analyserInstance?.minDecibels).toBe(-90);
    expect(analyserInstance?.maxDecibels).toBe(-10);
    expect(analyserInstance?.connect).toHaveBeenCalled();
    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(cancelAnimationFrameSpy).not.toHaveBeenCalled();
  });
});
