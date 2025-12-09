import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders control panel inputs and mock cluster grid", () => {
    render(<App />);

    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
    expect(screen.getByText("bright synthwave")).toBeInTheDocument();
    expect(screen.getByText("dark drones")).toBeInTheDocument();
  });
});
