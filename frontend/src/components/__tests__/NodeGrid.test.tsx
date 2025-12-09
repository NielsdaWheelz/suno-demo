import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import { NodeGrid } from "../NodeGrid";
import type { NodeView } from "../../types/ui";

const makeNode = (overrides: Partial<NodeView> = {}): NodeView => ({
  id: overrides.id ?? "node-1",
  track:
    overrides.track ??
    ({
      id: overrides.id ?? "node-1",
      audio_url: "/audio.wav",
      duration_sec: 4,
    } as NodeView["track"]),
  label: overrides.label ?? "label",
  generationIndex: overrides.generationIndex ?? 0,
  parentNodeId: overrides.parentNodeId,
  backendClusterId: overrides.backendClusterId ?? "cluster-1",
});

describe("NodeGrid", () => {
  it("groups nodes by generation and renders headings", () => {
    const nodes: NodeView[] = [
      makeNode({ id: "a", generationIndex: 0 }),
      makeNode({ id: "b", generationIndex: 0 }),
      makeNode({ id: "c", generationIndex: 1, parentNodeId: "a" }),
      makeNode({ id: "d", generationIndex: 2, parentNodeId: "c" }),
    ];

    render(
      <NodeGrid
        nodes={nodes}
        status="idle"
        onMoreLike={() => {}}
        onPlay={() => {}}
        onSelect={() => {}}
      />,
    );

    const headings = screen.getAllByText(/generation/i).map((el) => el.textContent);
    expect(headings).toEqual(["generation 0", "generation 1", "generation 2"]);
    expect(screen.getByTestId("node-card-a")).toBeInTheDocument();
    expect(screen.getByTestId("node-card-d")).toBeInTheDocument();
  });

  it("shows loading and empty states", () => {
    const { rerender } = render(
      <NodeGrid
        nodes={[]}
        status="loading"
        onMoreLike={() => {}}
        onPlay={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText(/generating/i)).toBeInTheDocument();

    rerender(
      <NodeGrid
        nodes={[]}
        status="idle"
        onMoreLike={() => {}}
        onPlay={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText(/no results yet/i)).toBeInTheDocument();
  });

  it("highlights selected node", () => {
    const nodes: NodeView[] = [makeNode({ id: "a" }), makeNode({ id: "b" })];

    render(
      <NodeGrid
        nodes={nodes}
        status="idle"
        selectedNodeId="b"
        onMoreLike={() => {}}
        onPlay={() => {}}
        onSelect={() => {}}
      />,
    );

    const selectedCard = screen.getByTestId("node-card-b");
    expect(selectedCard.className).toContain("border-sky-500");
  });

  it("disables actions and shows spinner while loading", () => {
    const nodes: NodeView[] = [makeNode({ id: "a" })];

    render(
      <NodeGrid
        nodes={nodes}
        status="loading"
        selectedNodeId="a"
        onMoreLike={() => {}}
        onPlay={() => {}}
        onSelect={() => {}}
      />,
    );

    const moreButton = screen.getByRole("button", { name: /generating/i });
    expect(moreButton).toBeDisabled();
    expect(moreButton.querySelector("svg")).not.toBeNull();
    const playButton = screen.getByRole("button", { name: /play/i });
    expect(playButton).toBeDisabled();
  });

  it("renders lineage lines for parent-child nodes", async () => {
    const nodes: NodeView[] = [
      makeNode({ id: "parent", generationIndex: 0 }),
      makeNode({ id: "child-1", generationIndex: 1, parentNodeId: "parent" }),
      makeNode({ id: "child-2", generationIndex: 1, parentNodeId: "parent" }),
    ];

    const { container } = render(
      <NodeGrid
        nodes={nodes}
        status="idle"
        onMoreLike={() => {}}
        onPlay={() => {}}
        onSelect={() => {}}
      />,
    );

    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
