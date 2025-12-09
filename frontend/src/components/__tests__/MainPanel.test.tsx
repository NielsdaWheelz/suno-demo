import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MainPanel } from "../MainPanel";

describe("MainPanel", () => {
  it("renders left and right content in separate containers", () => {
    render(
      <MainPanel
        left={<div data-testid="left-content">left</div>}
        right={<div data-testid="right-content">right</div>}
      />,
    );

    const left = screen.getByTestId("left-content");
    const right = screen.getByTestId("right-content");

    expect(left).toBeInTheDocument();
    expect(right).toBeInTheDocument();

    const container = left.parentElement?.parentElement;
    if (!container) throw new Error("missing container");
    const children = Array.from(container.children);
    expect(children[0].contains(left)).toBe(true);
    expect(children[1].contains(right)).toBe(true);
  });

  it("uses a two-column grid layout", () => {
    const { container } = render(<MainPanel left={<div />} right={<div />} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toMatch(/grid/);
    expect(root.className).toMatch(/grid-cols-\[minmax\(260px,340px\)_1fr\]/);
  });
});
