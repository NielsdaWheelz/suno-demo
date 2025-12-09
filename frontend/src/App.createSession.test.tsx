import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiError, createSession } from "./api/client";

vi.mock("./api/client", async () => {
  const actual = await vi.importActual<typeof import("./api/client")>("./api/client");
  return { ...actual, createSession: vi.fn() };
});

const createSessionMock = vi.mocked(createSession);

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

describe("App createSession flow", () => {
  beforeEach(() => {
    createSessionMock.mockReset();
  });

  it("runs successful createSession mutation and renders clusters", async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    const response = {
      session_id: "abc",
      batch: {
        clusters: [
          {
            id: "c1",
            label: "piano soft",
            tracks: [{ id: "t1", audio_url: "/x.wav", duration_sec: 4.0 }],
          },
        ],
      },
    };
    createSessionMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    renderApp();

    const generateButton = screen.getByRole("button", { name: /generate/i });
    fireEvent.click(generateButton);

    await screen.findAllByText(/generating/i);
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    resolveRequest?.(response);

    await waitFor(() => expect(screen.queryByText(/generating/i)).not.toBeInTheDocument());
    expect(screen.getAllByText("piano soft")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /more like this/i })).not.toBeDisabled();
  });

  it("surfaces errors when createSession fails", async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    createSessionMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        }),
    );

    renderApp();

    const generateButton = screen.getByRole("button", { name: /generate/i });
    fireEvent.click(generateButton);

    await screen.findAllByText(/generating/i);
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    rejectRequest?.(new ApiError("fail", 500));
    await waitFor(() =>
      expect(screen.getAllByText("Request failed (500)").length).toBeGreaterThan(0),
    );

    expect(screen.getByRole("button", { name: /generate/i })).not.toBeDisabled();
    expect(screen.queryByText("piano soft")).not.toBeInTheDocument();
  });
});
