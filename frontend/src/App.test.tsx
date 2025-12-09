import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders control panel inputs and placeholder", () => {
    render(<App />);

    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
    expect(screen.getByTestId("results-placeholder")).toBeInTheDocument();
  });
});
