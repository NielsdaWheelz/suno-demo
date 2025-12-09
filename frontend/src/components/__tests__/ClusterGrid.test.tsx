// /src/components/__tests__/ClusterGrid.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TrackOut } from "../../types/api";
import type { ClusterView } from "../../types/ui";
import { ClusterGrid } from "../ClusterGrid";

const makeCluster = (overrides: Partial<ClusterView> = {}): ClusterView => {
  const defaultTracks: TrackOut[] = [
    { id: "track-a", audio_url: "/a.wav", duration_sec: 5 },
  ];

  return {
    id: "cluster-a",
    label: "label-a",
    tracks: defaultTracks,
    source: "initial",
    ...overrides,
  };
};

describe("ClusterGrid", () => {
  it('shows "no results yet" when idle with no clusters', () => {
    render(
      <ClusterGrid
        clusters={[]}
        sessionId="session-1"
        status="idle"
        numClips={3}
        onMoreLike={() => {}}
        onTrackSelect={() => {}}
      />,
    );

    expect(screen.getByText("no results yet")).toBeInTheDocument();
  });

  it('shows "generating…" when loading with no clusters', () => {
    render(
      <ClusterGrid
        clusters={[]}
        sessionId="session-1"
        status="loading"
        numClips={3}
        onMoreLike={() => {}}
        onTrackSelect={() => {}}
      />,
    );

    expect(screen.getByText("generating…")).toBeInTheDocument();
  });

  it("renders one ClusterCard per cluster", () => {
    const clusters: ClusterView[] = [
      makeCluster({ id: "c1", label: "cluster one" }),
      makeCluster({ id: "c2", label: "cluster two" }),
    ];

    render(
      <ClusterGrid
        clusters={clusters}
        sessionId="session-1"
        status="idle"
        numClips={3}
        onMoreLike={() => {}}
        onTrackSelect={() => {}}
      />,
    );

    expect(screen.getByText("cluster one")).toBeInTheDocument();
    expect(screen.getByText("cluster two")).toBeInTheDocument();
  });

  it("forwards disabled logic to ClusterCard", () => {
    const cluster = makeCluster({ id: "c3", label: "cluster three" });

    const { rerender } = render(
      <ClusterGrid
        clusters={[cluster]}
        sessionId={null}
        status="idle"
        loadingClusterId={undefined}
        numClips={3}
        onMoreLike={() => {}}
        onTrackSelect={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /more like this/i })).toBeDisabled();

    rerender(
      <ClusterGrid
        clusters={[cluster]}
        sessionId="session-2"
        status="loading"
        loadingClusterId={undefined}
        numClips={3}
        onMoreLike={() => {}}
        onTrackSelect={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /more like this/i })).toBeDisabled();

    rerender(
      <ClusterGrid
        clusters={[cluster]}
        sessionId="session-2"
        status="idle"
        loadingClusterId="c3"
        numClips={3}
        onMoreLike={() => {}}
        onTrackSelect={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /more like this/i })).toBeDisabled();
  });
});
