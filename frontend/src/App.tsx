import { useMutation } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useState } from "react";
import { ApiError, createSession } from "./api/client";
import { BottomPlayer } from "./components/BottomPlayer";
import { ClusterGrid } from "./components/ClusterGrid";
import { ControlPanel } from "./components/ControlPanel";
import { MainPanel } from "./components/MainPanel";
import { ShellLayout } from "./components/ShellLayout";
import { Sidebar } from "./components/Sidebar";
import type { BriefParams, CreateSessionRequest } from "./types/api";
import type { ClusterView, ControlPanelState, SessionState } from "./types/ui";

export function App(): ReactElement {
  const [session, setSession] = useState<SessionState>({
    sessionId: null,
    clusters: [],
    status: "idle",
    loadingClusterId: undefined,
    errorMessage: undefined,
  });

  const [controls, setControls] = useState<ControlPanelState>({
    brief: "",
    numClips: 3,
    params: { energy: 0.5, density: 0.5, durationSec: 8 },
    canGenerate: true,
    loading: false,
    errorMessage: undefined,
  });

  const createSessionMutation = useMutation({
    mutationFn: (body: CreateSessionRequest) => createSession(body),
    onMutate: () => {
      setSession((prev) => ({ ...prev, status: "loading", errorMessage: undefined }));
      setControls((prev) => ({ ...prev, loading: true, errorMessage: undefined }));
    },
    onSuccess: (data) => {
      const clusters: ClusterView[] = data.batch.clusters.map((c) => ({
        id: c.id,
        label: c.label,
        tracks: c.tracks,
        source: "initial",
      }));

      setSession({
        sessionId: data.session_id,
        clusters,
        status: "idle",
        loadingClusterId: undefined,
        errorMessage: undefined,
      });

      setControls((prev) => ({ ...prev, loading: false }));
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? `Request failed (${err.status})` : "Unknown error";

      setSession((prev) => ({ ...prev, status: "error", errorMessage: message }));
      setControls((prev) => ({ ...prev, loading: false, errorMessage: message }));
    },
  });

  const handleBriefChange = (brief: string) => {
    setControls((prev) => ({ ...prev, brief }));
  };

  const handleNumClipsChange = (numClips: number) => {
    const clamped = Math.min(6, Math.max(1, Math.round(numClips)));
    setControls((prev) => ({ ...prev, numClips: clamped }));
  };

  const handleParamsChange = (params: BriefParams) => {
    setControls((prev) => ({ ...prev, params }));
  };

  const handleGenerate = () => {
    const body: CreateSessionRequest = {
      brief: controls.brief,
      num_clips: controls.numClips,
      params: controls.params,
    };
    createSessionMutation.mutate(body);
  };

  return (
    <ShellLayout
      sidebar={
        <Sidebar title="Suno Session Lab" items={[{ id: "create", label: "Create" }]} />
      }
      main={
        <MainPanel
          controlPanel={
            <ControlPanel
              {...controls}
              onBriefChange={handleBriefChange}
              onNumClipsChange={handleNumClipsChange}
              onParamsChange={handleParamsChange}
              onGenerate={handleGenerate}
            />
          }
          clustersArea={
            <ClusterGrid
              clusters={session.clusters}
              sessionId={session.sessionId}
              status={session.status}
              loadingClusterId={session.loadingClusterId}
              numClips={controls.numClips}
              onMoreLike={(id) => console.warn("stub", id)}
              onTrackSelect={(track, label) => console.warn("stub select", track, label)}
            />
          }
          status={session.status}
          errorMessage={session.errorMessage}
        />
      }
      bottom={<BottomPlayer />}
    />
  );
}
