import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellLayout } from "../ShellLayout";

describe("ShellLayout", () => {
  it("renders sidebar, main, and bottom regions", () => {
    const { container } = render(
      <ShellLayout
        sidebar={<div>Sidebar content</div>}
        main={<div>Main content</div>}
        bottom={<div>Bottom content</div>}
      />,
    );

    expect(screen.getByText("Sidebar content")).toBeInTheDocument();
    expect(screen.getByText("Main content")).toBeInTheDocument();
    expect(screen.getByText("Bottom content")).toBeInTheDocument();

    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("grid");
  });
});
