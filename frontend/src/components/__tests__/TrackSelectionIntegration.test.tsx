import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { BottomPlayer } from "../BottomPlayer";
import { ClusterGrid } from "../ClusterGrid";
import type { TrackOut } from "../../types/api";
import type { ClusterView } from "../../types/ui";

function TestHarness(): JSX.Element {
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

  const [currentTrack, setCurrentTrack] = useState<
    { track: TrackOut; clusterLabel: string } | undefined
  >(undefined);

  return (
    <>
      <ClusterGrid
        clusters={[cluster]}
        sessionId="session-1"
        status="idle"
        loadingClusterId={undefined}
        numClips={1}
        onMoreLike={() => {}}
        onTrackSelect={(selected, clusterLabel) =>
          setCurrentTrack({ track: selected, clusterLabel })
        }
      />
      <BottomPlayer currentTrack={currentTrack} />
    </>
  );
}

describe("track selection integration", () => {
  it("clicking select updates the bottom player", () => {
    const { container } = render(<TestHarness />);

    fireEvent.click(screen.getByRole("button", { name: /select/i }));

    expect(screen.getAllByText("driving techno")).toHaveLength(2);

    const audioEls = container.querySelectorAll("audio");
    expect(audioEls.length).toBeGreaterThanOrEqual(2);
    expect(audioEls[audioEls.length - 1]?.getAttribute("src")).toBe(
      "/media/session/track-a.wav",
    );
  });
});
