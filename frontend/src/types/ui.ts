import type { TrackOut } from "./api";

export type NodeId = string;

export type NodeView = {
  id: NodeId;
  track: TrackOut;
  label: string;
  generationIndex: number;
  parentNodeId?: NodeId;
  backendClusterId: string;
};

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
  nodes: NodeView[];
  status: SessionStatus;
  errorMessage?: string;
  nextGenerationIndex: number;
  selectedNodeId?: NodeId;
};

export type ControlPanelState = {
  brief: string;
  params: {
    energy: number; // 0..1
    density: number; // 0..1
    duration_sec: number; // UI may cap for ergonomics; backend uncapped
    tempo_bpm: number; // >0
    brightness: number; // 0..1
  };
  canGenerate: boolean;
  loading: boolean;
  errorMessage?: string;
  forceInstrumental: boolean;
};
