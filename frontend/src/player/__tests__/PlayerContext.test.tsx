import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TrackOut } from "../../types/api";
import { PlayerProvider, usePlayer } from "../PlayerContext";

describe("PlayerContext", () => {
  it("throws when usePlayer is called outside provider", () => {
    const Consumer = () => {
      usePlayer();
      return <div>ok</div>;
    };

    expect(() => render(<Consumer />)).toThrowError(
      "usePlayer must be used within PlayerProvider",
    );
  });

  it("updates currentTrack when playTrack is called", () => {
    const sampleTrack: TrackOut = {
      id: "track-12345678",
      audio_url: "/audio/sample.wav",
      duration_sec: 10,
    };

    const Harness = () => {
      const { currentTrack, playTrack } = usePlayer();

      return (
        <div>
          <div data-testid="current-id">
            {currentTrack ? currentTrack.track.id : "none"}
          </div>
          <button type="button" onClick={() => playTrack(sampleTrack, "label-1")}>
            play
          </button>
        </div>
      );
    };

    render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    );

    expect(screen.getByTestId("current-id").textContent).toBe("none");

    fireEvent.click(screen.getByText("play"));

    expect(screen.getByTestId("current-id").textContent).toBe(sampleTrack.id);
  });
});
