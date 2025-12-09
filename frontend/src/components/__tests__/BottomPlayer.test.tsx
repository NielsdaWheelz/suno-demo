import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { useEffect } from "react";
import type { TrackOut } from "../../types/api";
import { BottomPlayer } from "../BottomPlayer";
import { resolveApiUrl } from "../../api/client";
import { PlayerProvider, usePlayer } from "../../player/PlayerContext";

const playMock = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(playMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  playMock.mockClear();
});

describe("BottomPlayer", () => {
  it("shows idle state when no track is selected", () => {
    const { container } = render(
      <PlayerProvider>
        <BottomPlayer />
      </PlayerProvider>,
    );

    expect(screen.getByText(/select a track to preview/i)).toBeInTheDocument();
    expect(container.querySelector("audio")).toBeNull();
  });

  it("renders label, short id, and audio when a track is selected", () => {
    const track: TrackOut = {
      id: "11111111-2222-3333-4444-555555555555",
      audio_url: "/media/some-session/some-track.wav",
      duration_sec: 12,
    };

    const Harness = () => {
      const { playTrack } = usePlayer();

      useEffect(() => {
        playTrack(track, "bright synthwave");
      }, [playTrack]);

      return <BottomPlayer />;
    };

    const { container } = render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    );

    expect(screen.getByText("bright synthwave")).toBeInTheDocument();
    expect(screen.getByText(track.id.slice(0, 8))).toBeInTheDocument();

    const audioEl = container.querySelector("audio");
    expect(audioEl).not.toBeNull();
    expect(audioEl?.getAttribute("src")).toBe(resolveApiUrl(track.audio_url));
    expect(playMock).toHaveBeenCalled();
  });
});
