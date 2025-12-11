import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreateSessionRequest } from "../types/api";

const BASE_URL = "http://localhost:8000";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const loadClient = async () => {
  vi.resetModules();
  return import("./client");
};

describe("createSession", () => {
  it("sends POST to /sessions and returns parsed data on success", async () => {
    vi.stubEnv("VITE_API_BASE", BASE_URL);
    const mockResponse = { session_id: "s1", batch: { id: "b1", clusters: [] } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const body: CreateSessionRequest = {
      brief: "A dark synthwave track",
      num_clips: 3,
      params: {
        energy: 0.8,
        density: 0.6,
        duration_sec: 8,
        tempo_bpm: 120,
        brightness: 0.6,
      },
    };

    const { createSession } = await loadClient();

    const data = await createSession(body);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(data).toStrictEqual(mockResponse);
  });

  it("throws ApiError with parsed body on non-2xx", async () => {
    vi.stubEnv("VITE_API_BASE", BASE_URL);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: "boom" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const body: CreateSessionRequest = {
      brief: "Test",
      num_clips: 1,
      params: {
        energy: 0.2,
        density: 0.3,
        duration_sec: 5,
        tempo_bpm: 100,
        brightness: 0.4,
      },
    };

    const { createSession, ApiError } = await loadClient();

    let caught: unknown;
    try {
      await createSession(body);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiError = caught as InstanceType<typeof ApiError>;
    expect(apiError.status).toBe(500);
    expect(apiError.body).toStrictEqual({ detail: "boom" });
    expect(apiError.message).toBe("createSession failed");
  });
});

describe("moreLikeCluster", () => {
  it("posts to /sessions/{id}/clusters/{id}/more and returns data", async () => {
    vi.stubEnv("VITE_API_BASE", BASE_URL);
    const mockResponse = {
      session_id: "s1",
      parent_cluster_id: "c0",
      batch: { id: "b2", clusters: [] },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { moreLikeCluster } = await loadClient();

    const data = await moreLikeCluster("s1", "c1", { num_clips: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/sessions/s1/clusters/c1/more`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num_clips: 2 }),
      },
    );
    expect(data).toStrictEqual(mockResponse);
  });

  it("throws ApiError with status and body on failure", async () => {
    vi.stubEnv("VITE_API_BASE", BASE_URL);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: "missing" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { moreLikeCluster, ApiError } = await loadClient();

    let caught: unknown;
    try {
      await moreLikeCluster("s1", "c1", { num_clips: 2 });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiError = caught as InstanceType<typeof ApiError>;
    expect(apiError.status).toBe(404);
    expect(apiError.body).toStrictEqual({ detail: "missing" });
    expect(apiError.message.startsWith("moreLikeCluster failed")).toBe(true);
  });
});
