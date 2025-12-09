import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClusterView } from "../../types/ui";
import { ClusterTrailBar } from "../ClusterTrailBar";

const makeCluster = (id: string, label: string, parentClusterId?: string): ClusterView => ({
  id,
  label,
  parentClusterId,
  source: parentClusterId ? "more" : "initial",
  tracks: [{ id: `track-${id}`, audio_url: `/audio/${id}.wav`, duration_sec: 4 }],
});

describe("ClusterTrailBar", () => {
  it("renders trail root to leaf order", () => {
    const clusters: ClusterView[] = [
      makeCluster("a", "label-a"),
      makeCluster("b", "label-b", "a"),
      makeCluster("c", "label-c", "b"),
    ];

    render(
      <ClusterTrailBar clusters={clusters} activeClusterId="c" onSelectCluster={() => {}} />,
    );

    const labels = screen
      .getAllByRole("button")
      .map((btn) => btn.textContent)
      .filter((text) => text && text !== "All");

    expect(labels).toEqual(["label-a", "label-b", "label-c"]);
  });

  it("calls onSelectCluster when a crumb is clicked", () => {
    const clusters: ClusterView[] = [
      makeCluster("a", "label-a"),
      makeCluster("b", "label-b", "a"),
      makeCluster("c", "label-c", "b"),
    ];
    const onSelect = vi.fn();

    render(
      <ClusterTrailBar clusters={clusters} activeClusterId="c" onSelectCluster={onSelect} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "label-b" }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("shows placeholder when there is no active cluster", () => {
    const clusters: ClusterView[] = [
      makeCluster("a", "label-a"),
      makeCluster("b", "label-b", "a"),
    ];

    render(<ClusterTrailBar clusters={clusters} activeClusterId={undefined} onSelectCluster={() => {}} />);

    expect(screen.getByText(/no active branch yet/i)).toBeInTheDocument();
  });
});
