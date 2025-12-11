export type BriefParams = {
  energy: number; // 0..1
  density: number; // 0..1
  duration_sec: number; // >0, UI default range but backend uncapped
  tempo_bpm: number; // >0
  brightness: number; // 0..1
};

export interface CreateSessionRequest {
  brief: string; // non-empty
  num_clips: number; // integer in [1, 6]
  params: BriefParams;
}

export interface TrackOut {
  id: string;
  audio_url: string;
  duration_sec: number;
}

export interface ClusterOut {
  id: string;
  label: string;
  tracks: TrackOut[];
}

export interface BatchOut {
  id: string;
  clusters: ClusterOut[];
}

export interface CreateSessionResponse {
  session_id: string;
  batch: BatchOut;
}

export interface MoreLikeResponse {
  session_id: string;
  parent_cluster_id: string;
  batch: BatchOut;
}

export interface MusicSettingsUpdate {
  force_instrumental: boolean;
}
