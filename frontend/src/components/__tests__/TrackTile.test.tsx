// /src/components/__tests__/TrackTile.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TrackOut } from "../../types/api";
import { TrackTile } from "../TrackTile";

const sampleTrack: TrackOut = {
  id: "abcdefghijk",
  audio_url: "/sample.wav",
  duration_sec: 12,
};

describe("TrackTile", () => {
  it("renders id slice and duration", () => {
    render(<TrackTile track={sampleTrack} clusterLabel="cluster-1" onSelect={vi.fn()} />);

    expect(screen.getByText("abcdefgh")).toBeInTheDocument();
    expect(screen.getByText("12s")).toBeInTheDocument();
  });

  it("sets audio src to track url", () => {
    const { container } = render(
      <TrackTile track={sampleTrack} clusterLabel="cluster-1" onSelect={vi.fn()} />,
    );

    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute("src", sampleTrack.audio_url);
  });

  it("calls onSelect with track and label when button clicked", () => {
    const onSelect = vi.fn();

    render(<TrackTile track={sampleTrack} clusterLabel="cluster-1" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /select/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleTrack, "cluster-1");
  });
});
