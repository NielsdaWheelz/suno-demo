import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiError, createSession, moreLikeCluster } from "./api/client";

vi.mock("./api/client", async () => {
  const actual = await vi.importActual<typeof import("./api/client")>("./api/client");
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

const initialSessionResponse = {
  session_id: "session-123",
  batch: {
    clusters: [
      {
        id: "cluster-1",
        label: "initial cluster",
        tracks: [
          { id: "track-1", audio_url: "/media/session-123/track-1.wav", duration_sec: 10 },
        ],
      },
    ],
  },
};

describe("App more like flow", () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    moreLikeMock.mockReset();
  });

  it("appends new cluster from moreLikeCluster success", async () => {
    createSessionMock.mockResolvedValueOnce(initialSessionResponse);

    let resolveMore: ((value: unknown) => void) | undefined;
    const moreResponse = {
      session_id: "session-123",
      parent_cluster_id: "parent-111",
      batch: {
        id: "batch-more-1",
        clusters: [
          {
            id: "cluster-more-1",
            label: "more cluster",
            tracks: [
              {
                id: "track-more-1",
                audio_url: "/media/session-123/track-more-1.wav",
                duration_sec: 12,
              },
            ],
          },
        ],
      },
    };

    moreLikeMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMore = resolve;
        }),
    );

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    await screen.findByText("initial cluster");

    const moreButton = screen.getByRole("button", { name: /more like this/i });
    fireEvent.click(moreButton);

    await waitFor(() => expect(moreLikeMock).toHaveBeenCalledTimes(1));
    expect(moreLikeMock).toHaveBeenCalledWith("session-123", "cluster-1", { num_clips: 3 });

    resolveMore?.(moreResponse);

    await screen.findByText("more cluster");
    expect(screen.getAllByText("more").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(/idle/i)).toBeInTheDocument());

    expect(screen.getAllByText(/cluster/i).length).toBeGreaterThan(1);
  });

  it("surfaces error and re-enables button when moreLikeCluster fails", async () => {
    createSessionMock.mockResolvedValueOnce(initialSessionResponse);
    const apiError = new ApiError("boom", 500, {});
    moreLikeMock.mockRejectedValueOnce(apiError);

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    await screen.findByText("initial cluster");

    const moreButton = screen.getByRole("button", { name: /more like this/i });
    fireEvent.click(moreButton);

    await waitFor(() => expect(moreLikeMock).toHaveBeenCalledTimes(1));
    await screen.findAllByText("Request failed (500)");

    await waitFor(() => expect(moreButton).not.toBeDisabled());
    expect(screen.queryByText("more cluster")).not.toBeInTheDocument();
  });
});
