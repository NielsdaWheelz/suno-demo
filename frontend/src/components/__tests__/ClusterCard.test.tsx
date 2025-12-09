// /src/components/__tests__/ClusterCard.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TrackOut } from "../../types/api";
import type { ClusterView } from "../../types/ui";
import { ClusterCard } from "../ClusterCard";

const tracks: TrackOut[] = [
  { id: "track-1-id", audio_url: "/t1.wav", duration_sec: 4 },
  { id: "track-2-id", audio_url: "/t2.wav", duration_sec: 6 },
];

const baseCluster: ClusterView = {
  id: "cluster-1",
  label: "ambient pads",
  tracks,
  source: "initial",
};

describe("ClusterCard", () => {
  it("renders label and source tag", () => {
    render(
      <ClusterCard
        cluster={baseCluster}
        disabled={false}
        onMoreLike={vi.fn()}
        onTrackSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("ambient pads")).toBeInTheDocument();
    expect(screen.getByText("initial")).toBeInTheDocument();
  });

  it("renders parent cluster slice when provided", () => {
    const clusterWithParent: ClusterView = {
      ...baseCluster,
      parentClusterId: "parent-123456789",
    };

    render(
      <ClusterCard
        cluster={clusterWithParent}
        disabled={false}
        onMoreLike={vi.fn()}
        onTrackSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("from parent-1")).toBeInTheDocument();
  });

  it('"More like this" calls handler when enabled', () => {
    const onMoreLike = vi.fn();

    render(
      <ClusterCard
        cluster={baseCluster}
        disabled={false}
        onMoreLike={onMoreLike}
        onTrackSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /more like this/i }));

    expect(onMoreLike).toHaveBeenCalledTimes(1);
    expect(onMoreLike).toHaveBeenCalledWith(baseCluster.id);
  });

  it("does not call handler when disabled", () => {
    const onMoreLike = vi.fn();

    render(
      <ClusterCard
        cluster={baseCluster}
        disabled={true}
        onMoreLike={onMoreLike}
        onTrackSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /generating/i }));

    expect(onMoreLike).not.toHaveBeenCalled();
  });

  it("renders one TrackTile per track", () => {
    render(
      <ClusterCard
        cluster={baseCluster}
        disabled={false}
        onMoreLike={vi.fn()}
        onTrackSelect={vi.fn()}
      />,
    );

    const selectButtons = screen.getAllByRole("button", { name: /send to player/i });
    expect(selectButtons).toHaveLength(tracks.length);
  });
});
