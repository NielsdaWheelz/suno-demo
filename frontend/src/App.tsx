import { useMutation } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useState } from "react";
import { ApiError, createSession, moreLikeCluster } from "./api/client";
import { BottomPlayer } from "./components/BottomPlayer";
import { ClusterTrailBar } from "./components/ClusterTrailBar";
import { ClusterGrid } from "./components/ClusterGrid";
import { ControlPanel } from "./components/ControlPanel";
import { MainPanel } from "./components/MainPanel";
import { ShellLayout } from "./components/ShellLayout";
import { Sidebar } from "./components/Sidebar";
import { PlayerProvider } from "./player/PlayerContext";
import type { BriefParams, CreateSessionRequest } from "./types/api";
import type { ClusterView, ControlPanelState, SessionState } from "./types/ui";

export function App(): ReactElement {
  const [session, setSession] = useState<SessionState>({
    sessionId: null,
    clusters: [],
    status: "idle",
    loadingClusterId: undefined,
    errorMessage: undefined,
    activeClusterId: undefined,
  });

  const [controls, setControls] = useState<ControlPanelState>({
    brief: "",
    numClips: 3,
    params: { energy: 0.5, density: 0.5, duration_sec: 8 },
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
        activeClusterId: undefined,
      });

      setControls((prev) => ({ ...prev, loading: false }));
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? typeof err.body === "object" && err.body && "detail" in err.body
            ? String((err.body as Record<string, unknown>).detail)
            : `Request failed (${err.status})`
          : "Unknown error";

      setSession((prev) => ({ ...prev, status: "error", errorMessage: message }));
      setControls((prev) => ({ ...prev, loading: false, errorMessage: message }));
    },
  });

  const moreLikeMutation = useMutation({
    mutationFn: ({
      sessionId,
      clusterId,
      numClips,
    }: { sessionId: string; clusterId: string; numClips: number }) =>
      moreLikeCluster(sessionId, clusterId, { num_clips: numClips }),
    onMutate: ({ clusterId }) => {
      setSession((prev) => ({
        ...prev,
        status: "loading",
        loadingClusterId: clusterId,
        errorMessage: undefined,
      }));
    },
    onSuccess: (data) => {
      const serverCluster = data.batch.clusters[0]; // spec: exactly one
      const newCluster: ClusterView = {
        id: serverCluster.id,
        label: serverCluster.label,
        tracks: serverCluster.tracks,
        source: "more",
        parentClusterId: data.parent_cluster_id,
      };
      setSession((prev) => ({
        sessionId: data.session_id,
        clusters: [...prev.clusters, newCluster],
        status: "idle",
        loadingClusterId: undefined,
        errorMessage: undefined,
        activeClusterId: newCluster.id,
      }));
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? typeof err.body === "object" && err.body && "detail" in err.body
            ? String((err.body as Record<string, unknown>).detail)
            : `Request failed (${err.status})`
          : "Unknown error";
      setSession((prev) => ({
        ...prev,
        status: "error",
        loadingClusterId: undefined,
        errorMessage: message,
      }));
      setControls((prev) => ({ ...prev, errorMessage: message }));
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

  const handleMoreLike = (clusterId: string) => {
    const sid = session.sessionId;
    if (!sid) return;
    setSession((prev) => ({
      ...prev,
      activeClusterId: clusterId,
    }));
    moreLikeMutation.mutate({
      sessionId: sid,
      clusterId,
      numClips: controls.numClips,
    });
  };

  const handleSelectCluster = (clusterId: string | undefined) => {
    setSession((prev) => ({
      ...prev,
      activeClusterId: clusterId,
    }));
  };

  return (
    <PlayerProvider>
      <ShellLayout
        sidebar={
          <Sidebar title="Suno Session Lab" items={[{ id: "create", label: "Create" }]} />
        }
        main={
          <MainPanel
            left={
              <ControlPanel
                {...controls}
                onBriefChange={handleBriefChange}
                onNumClipsChange={handleNumClipsChange}
                onParamsChange={handleParamsChange}
                onGenerate={handleGenerate}
              />
            }
            right={
              <div className="flex h-full flex-col gap-3">
                <ClusterTrailBar
                  clusters={session.clusters}
                  activeClusterId={session.activeClusterId}
                  onSelectCluster={handleSelectCluster}
                />
                <ClusterGrid
                  clusters={session.clusters}
                  sessionId={session.sessionId}
                  status={session.status}
                  loadingClusterId={session.loadingClusterId}
                  numClips={controls.numClips}
                  activeClusterId={session.activeClusterId}
                  onMoreLike={handleMoreLike}
                  onSelectCluster={(id) => handleSelectCluster(id)}
                />
              </div>
            }
          />
        }
        bottom={<BottomPlayer />}
      />
    </PlayerProvider>
  );
}
