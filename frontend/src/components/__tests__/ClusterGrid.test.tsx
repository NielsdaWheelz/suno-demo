// /src/components/__tests__/ClusterGrid.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TrackOut } from "../../types/api";
import type { ClusterView } from "../../types/ui";
import { PlayerProvider } from "../../player/PlayerContext";
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
      <PlayerProvider>
        <ClusterGrid
          clusters={[]}
          sessionId="session-1"
          status="idle"
          numClips={3}
          activeClusterId={undefined}
          onMoreLike={() => {}}
          onSelectCluster={() => {}}
        />
      </PlayerProvider>,
    );

    expect(screen.getByText(/no results yet/i)).toBeInTheDocument();
  });

  it('shows "generating…" when loading with no clusters', () => {
    render(
      <PlayerProvider>
        <ClusterGrid
          clusters={[]}
          sessionId="session-1"
          status="loading"
          numClips={3}
          activeClusterId={undefined}
          onMoreLike={() => {}}
          onSelectCluster={() => {}}
        />
      </PlayerProvider>,
    );

    expect(screen.getByText(/generating/i)).toBeInTheDocument();
  });

  it("renders one ClusterCard per cluster", () => {
    const clusters: ClusterView[] = [
      makeCluster({ id: "c1", label: "cluster one" }),
      makeCluster({ id: "c2", label: "cluster two" }),
    ];

    render(
      <PlayerProvider>
        <ClusterGrid
          clusters={clusters}
          sessionId="session-1"
          status="idle"
          numClips={3}
          activeClusterId={undefined}
          onMoreLike={() => {}}
          onSelectCluster={() => {}}
        />
      </PlayerProvider>,
    );

    expect(screen.getByText("cluster one")).toBeInTheDocument();
    expect(screen.getByText("cluster two")).toBeInTheDocument();
  });

  it("forwards disabled logic to ClusterCard", () => {
    const cluster = makeCluster({ id: "c3", label: "cluster three" });

    const { rerender } = render(
      <PlayerProvider>
        <ClusterGrid
          clusters={[cluster]}
          sessionId={null}
          status="idle"
          loadingClusterId={undefined}
          numClips={3}
          activeClusterId={undefined}
          onMoreLike={() => {}}
          onSelectCluster={() => {}}
        />
      </PlayerProvider>,
    );

    expect(screen.getByRole("button", { name: /generating/i })).toBeDisabled();

    rerender(
      <PlayerProvider>
        <ClusterGrid
          clusters={[cluster]}
          sessionId="session-2"
          status="loading"
          loadingClusterId={undefined}
          numClips={3}
          activeClusterId={undefined}
          onMoreLike={() => {}}
          onSelectCluster={() => {}}
        />
      </PlayerProvider>,
    );

    expect(screen.getByRole("button", { name: /generating/i })).toBeDisabled();

    rerender(
      <PlayerProvider>
        <ClusterGrid
          clusters={[cluster]}
          sessionId="session-2"
          status="idle"
          loadingClusterId="c3"
          numClips={3}
          activeClusterId={undefined}
          onMoreLike={() => {}}
          onSelectCluster={() => {}}
        />
      </PlayerProvider>,
    );

    expect(screen.getByRole("button", { name: /generating/i })).toBeDisabled();
  });

  it("marks trail clusters and active cluster with styling", () => {
    const clusters: ClusterView[] = [
      makeCluster({ id: "a", label: "cluster a" }),
      makeCluster({ id: "b", label: "cluster b", parentClusterId: "a", source: "more" }),
      makeCluster({ id: "c", label: "cluster c", parentClusterId: "b", source: "more" }),
      makeCluster({ id: "d", label: "cluster d", parentClusterId: "x", source: "more" }),
    ];

    render(
      <PlayerProvider>
        <ClusterGrid
          clusters={clusters}
          sessionId="session-1"
          status="idle"
          numClips={3}
          activeClusterId="c"
          onMoreLike={() => {}}
          onSelectCluster={() => {}}
        />
      </PlayerProvider>,
    );

    expect(screen.getByTestId("cluster-card-a").className).toContain("border-sky-700");
    expect(screen.getByTestId("cluster-card-b").className).toContain("border-sky-700");
    expect(screen.getByTestId("cluster-card-c").className).toContain("border-sky-400");
    expect(screen.getByTestId("cluster-card-d").className).toContain("border-slate-800");
  });

  it("invokes onSelectCluster when a card header is clicked", () => {
    const clusters: ClusterView[] = [
      makeCluster({ id: "a", label: "cluster a" }),
      makeCluster({ id: "b", label: "cluster b" }),
    ];
    const onSelect = vi.fn();

    render(
      <PlayerProvider>
        <ClusterGrid
          clusters={clusters}
          sessionId="session-1"
          status="idle"
          numClips={3}
          activeClusterId="b"
          onMoreLike={() => {}}
          onSelectCluster={onSelect}
        />
      </PlayerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "cluster a" }));
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});
