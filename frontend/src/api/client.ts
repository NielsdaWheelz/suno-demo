import type {
  CreateSessionRequest,
  CreateSessionResponse,
  MoreLikeResponse,
} from "../types/api";

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE ?? "";

export const resolveApiUrl = (path: string): string => {
  try {
    return new URL(path, API_BASE_URL || window.location.origin).toString();
  } catch {
    return path;
  }
};

export async function createSession(
  body: CreateSessionRequest,
): Promise<CreateSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = undefined;
    }
    throw new ApiError("createSession failed", res.status, parsed);
  }

  return (await res.json()) as CreateSessionResponse;
}

export async function moreLikeCluster(
  sessionId: string,
  clusterId: string,
  body: { num_clips: number },
): Promise<MoreLikeResponse> {
  const res = await fetch(
    `${API_BASE_URL}/sessions/${sessionId}/clusters/${clusterId}/more`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = undefined;
    }
    throw new ApiError("moreLikeCluster failed", res.status, parsed);
  }

  return (await res.json()) as MoreLikeResponse;
}
