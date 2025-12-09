import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MainPanel } from "../MainPanel";

describe("MainPanel", () => {
  it("renders children", () => {
    render(
      <MainPanel>
        <div>Child content</div>
      </MainPanel>,
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });
});
