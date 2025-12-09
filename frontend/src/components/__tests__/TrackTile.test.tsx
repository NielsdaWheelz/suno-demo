// /src/components/__tests__/TrackTile.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TrackOut } from "../../types/api";
import type { PlayerContextValue } from "../../player/PlayerContext";
import { PlayerContext } from "../../player/PlayerContext";
import { TrackTile } from "../TrackTile";

const sampleTrack: TrackOut = {
  id: "abcdefghijk",
  audio_url: "/sample.wav",
  duration_sec: 12,
};

describe("TrackTile", () => {
  it("renders id slice and duration", () => {
    const value: PlayerContextValue = {
      currentTrack: undefined,
      playTrack: () => {},
    };

    render(
      <PlayerContext.Provider value={value}>
        <TrackTile track={sampleTrack} clusterLabel="cluster-1" />
      </PlayerContext.Provider>,
    );

    expect(screen.getByText("abcdefgh")).toBeInTheDocument();
    expect(screen.getByText("12s")).toBeInTheDocument();
  });

  it("calls playTrack with track and label when Play is clicked", () => {
    let lastCalled: { track?: TrackOut; clusterLabel?: string } = {};

    const value: PlayerContextValue = {
      currentTrack: undefined,
      playTrack: (track, clusterLabel) => {
        lastCalled = { track, clusterLabel };
      },
    };

    render(
      <PlayerContext.Provider value={value}>
        <TrackTile track={sampleTrack} clusterLabel="cluster-1" />
      </PlayerContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /▶/i }));

    expect(lastCalled.track).toEqual(sampleTrack);
    expect(lastCalled.clusterLabel).toBe("cluster-1");
  });
});
