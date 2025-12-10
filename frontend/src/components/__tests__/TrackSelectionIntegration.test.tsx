import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { ReactElement } from "react";
import { BottomPlayer } from "../BottomPlayer";
import { NodeGrid } from "../NodeGrid";
import { PlayerProvider, usePlayer } from "../../player/PlayerContext";
import { resolveApiUrl } from "../../api/client";
import type { TrackOut } from "../../types/api";
import type { NodeView } from "../../types/ui";

const track: TrackOut = {
  id: "aaaaaaa1-bbbb-cccc-dddd-eeeeeeeeeeee",
  audio_url: "/media/session/track-a.wav",
  duration_sec: 8,
};

const node: NodeView = {
  id: "aaaaaaa1-bbbb-cccc-dddd-eeeeeeeeeeee",
  track,
  label: "driving techno",
  generationIndex: 0,
  parentNodeId: undefined,
  backendClusterId: "cluster-123",
};

const playMock = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(playMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  playMock.mockClear();
});

function GridHarness(): ReactElement {
  const { playTrack } = usePlayer();
  return (
    <>
      <NodeGrid
        nodes={[node]}
        status="idle"
        onMoreLike={() => {}}
        onPlay={(n) => playTrack(n.track, n.label)}
        onSelect={() => {}}
      />
      <BottomPlayer />
    </>
  );
}

function TestHarness(): ReactElement {
  return (
    <PlayerProvider>
      <GridHarness />
    </PlayerProvider>
  );
}

describe("track selection integration", () => {
  it("clicking play updates the bottom player context", () => {
    const { container } = render(<TestHarness />);

    fireEvent.click(screen.getByRole("button", { name: /play/i }));

    const labels = screen.getAllByText("driving techno");
    expect(labels.length).toBeGreaterThanOrEqual(2);

    const audioEls = container.querySelectorAll("audio");
    expect(audioEls).toHaveLength(1);
    expect(audioEls[0]?.getAttribute("src")).toBe(resolveApiUrl(track.audio_url));
    expect(playMock).toHaveBeenCalled();
  });
});
