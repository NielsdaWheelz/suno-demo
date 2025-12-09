import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomPlayer } from "../BottomPlayer";

describe("BottomPlayer", () => {
  it("shows placeholder text when no track selected", () => {
    render(<BottomPlayer />);

    expect(
      screen.getByText(/select a track to preview/i),
    ).toBeInTheDocument();
  });

  it("renders current track label and short id", () => {
    render(
      <BottomPlayer
        currentTrack={{ label: "Track Label", trackId: "abcdefgh12345678" }}
      />,
    );

    expect(screen.getByText("Track Label")).toBeInTheDocument();
    expect(screen.getByText(/abcdefgh/)).toBeInTheDocument();
  });
});
