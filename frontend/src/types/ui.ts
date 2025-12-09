import type { TrackOut } from "./api";

export type ClusterView = {
  id: string;
  label: string;
  tracks: TrackOut[];
  parentClusterId?: string;
  source: "initial" | "more";
};

export type SessionStatus = "idle" | "loading" | "error";

export type SessionState = {
  sessionId: string | null;
  clusters: ClusterView[];
  status: SessionStatus;
  loadingClusterId?: string; // when set, that cluster's "more like this" shows loading/disabled
  errorMessage?: string;
};

export type ControlPanelState = {
  brief: string;
  numClips: number; // always integer in [1, 6]; UI will clamp
  params: {
    energy: number; // 0..1
    density: number; // 0..1
    duration_sec: number; // 1..10 in UI, but backend accepts up to 30
  };
  canGenerate: boolean;
  loading: boolean;
  errorMessage?: string;
};
