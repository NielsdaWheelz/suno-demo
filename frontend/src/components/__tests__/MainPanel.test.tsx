import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MainPanel } from "../MainPanel";

describe("MainPanel", () => {
  it("renders control and cluster areas with status", () => {
    render(
      <MainPanel
        controlPanel={<div>controls</div>}
        clustersArea={<div>clusters</div>}
        status="idle"
        errorMessage={undefined}
      />,
    );

    expect(screen.getByText("controls")).toBeInTheDocument();
    expect(screen.getByText("clusters")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows error banner when provided", () => {
    render(
      <MainPanel
        controlPanel={<div>controls</div>}
        clustersArea={<div>clusters</div>}
        status="error"
        errorMessage="something went wrong"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("something went wrong");
  });
});
