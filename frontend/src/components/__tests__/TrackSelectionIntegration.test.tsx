import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { JSX } from "react";
import { BottomPlayer } from "../BottomPlayer";
import { ClusterGrid } from "../ClusterGrid";
import { PlayerProvider } from "../../player/PlayerContext";
import { resolveApiUrl } from "../../api/client";
import type { TrackOut } from "../../types/api";
import type { ClusterView } from "../../types/ui";

const track: TrackOut = {
  id: "aaaaaaa1-bbbb-cccc-dddd-eeeeeeeeeeee",
  audio_url: "/media/session/track-a.wav",
  duration_sec: 8,
};

const cluster: ClusterView = {
  id: "cluster-123",
  label: "driving techno",
  tracks: [track],
  source: "initial",
};

const playMock = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(playMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  playMock.mockClear();
});

function TestHarness(): JSX.Element {

  return (
    <PlayerProvider>
      <ClusterGrid
        clusters={[cluster]}
        sessionId="session-1"
        status="idle"
        loadingClusterId={undefined}
        numClips={1}
        onMoreLike={() => {}}
      />
      <BottomPlayer />
    </PlayerProvider>
  );
}

describe("track selection integration", () => {
  it("clicking play updates the bottom player context", () => {
    const { container } = render(<TestHarness />);

    fireEvent.click(screen.getByRole("button", { name: /▶/i }));

    const labels = screen.getAllByText("driving techno");
    expect(labels.length).toBeGreaterThanOrEqual(2);

    const audioEls = container.querySelectorAll("audio");
    expect(audioEls).toHaveLength(1);
    expect(audioEls[0]?.getAttribute("src")).toBe(resolveApiUrl(track.audio_url));
    expect(playMock).toHaveBeenCalled();
  });
});
