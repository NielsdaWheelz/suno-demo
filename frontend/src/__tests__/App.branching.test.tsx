import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { createSession, moreLikeCluster } from "../api/client";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, createSession: vi.fn(), moreLikeCluster: vi.fn() };
});

const createSessionMock = vi.mocked(createSession);
const moreLikeMock = vi.mocked(moreLikeCluster);

const createClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderApp = () =>
  render(
    <QueryClientProvider client={createClient()}>
      <App />
    </QueryClientProvider>,
  );

describe("App branching behavior", () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    moreLikeMock.mockReset();
  });

  it("highlights the selected node when branching", async () => {
    createSessionMock.mockResolvedValueOnce({
      session_id: "session-1",
      batch: {
        id: "batch-1",
        clusters: [
          {
            id: "c1",
            label: "cluster one",
            tracks: [{ id: "t1", audio_url: "/a.wav", duration_sec: 4 }],
          },
        ],
      },
    });

    moreLikeMock.mockResolvedValueOnce({
      session_id: "session-1",
      parent_cluster_id: "c1",
      batch: {
        id: "batch-2",
        clusters: [
          {
            id: "c2",
            label: "cluster two",
            tracks: [{ id: "t2", audio_url: "/b.wav", duration_sec: 5 }],
          },
        ],
      },
    });

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    await screen.findAllByText("cluster one");

    const moreButton = screen.getByRole("button", { name: /more like this/i });
    fireEvent.click(moreButton);
    await waitFor(() => expect(moreLikeMock).toHaveBeenCalled());

    const parentCard = screen.getByTestId("node-card-t1");
    expect(parentCard.className).toContain("border-sky-500");
  });
});
