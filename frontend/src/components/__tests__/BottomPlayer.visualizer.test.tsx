import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import type { TrackOut } from "../../types/api";
import { BottomPlayer } from "../BottomPlayer";
import { PlayerProvider, usePlayer } from "../../player/PlayerContext";
import { useAudioVisualizer } from "../../hooks/useAudioVisualizer";

vi.mock("../../hooks/useAudioVisualizer", () => ({
  useAudioVisualizer: vi.fn(),
}));

const playMock = vi.fn(() => Promise.resolve());
const mockedUseAudioVisualizer = useAudioVisualizer as unknown as ReturnType<typeof vi.fn>;

describe("BottomPlayer visualizer integration", () => {
  beforeEach(() => {
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(playMock);
    mockedUseAudioVisualizer.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    playMock.mockClear();
  });

  it("does not render canvas when no track selected", () => {
    const { container } = render(
      <PlayerProvider>
        <BottomPlayer />
      </PlayerProvider>,
    );

    expect(container.querySelector("canvas")).toBeNull();
    expect(screen.getByText(/player idle - select a track to preview/i)).toBeInTheDocument();
  });

  it("renders canvas and calls useAudioVisualizer when track is present", () => {
    const track: TrackOut = {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      audio_url: "/media/fake.wav",
      duration_sec: 10,
    };

    const Harness = () => {
      const { playTrack } = usePlayer();
      useEffect(() => {
        playTrack(track, "test cluster");
      }, [playTrack]);
      return <BottomPlayer />;
    };

    const { container } = render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    );

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector("audio")).not.toBeNull();
    expect(screen.getByText("test cluster")).toBeInTheDocument();
    expect(useAudioVisualizer).toHaveBeenCalled();
  });
});
