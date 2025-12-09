import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "../Sidebar";

describe("Sidebar", () => {
  it("renders title and items", () => {
    render(
      <Sidebar
        title="Test Title"
        items={[
          { id: "home", label: "Home" },
          { id: "create", label: "Create" },
        ]}
      />,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
  });
});
