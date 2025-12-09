import { useMutation } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useState } from "react";
import { ApiError, createSession, moreLikeCluster } from "./api/client";
import { BottomPlayer } from "./components/BottomPlayer";
import { ControlPanel } from "./components/ControlPanel";
import { MainPanel } from "./components/MainPanel";
import { NodeGrid } from "./components/NodeGrid";
import { ShellLayout } from "./components/ShellLayout";
import { Sidebar } from "./components/Sidebar";
import { nodesFromInitialBatch, nodesFromMoreLike } from "./logic/nodes";
import { PlayerProvider, usePlayer } from "./player/PlayerContext";
import type { BriefParams, CreateSessionRequest } from "./types/api";
import type { ControlPanelState, NodeView, SessionState } from "./types/ui";

const NUM_CLIPS = 3;

function AppContent(): ReactElement {
  const { playTrack } = usePlayer();
  const [session, setSession] = useState<SessionState>({
    sessionId: null,
    nodes: [],
    status: "idle",
    errorMessage: undefined,
    nextGenerationIndex: 0,
    selectedNodeId: undefined,
  });

  const [controls, setControls] = useState<ControlPanelState>({
    brief: "",
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
      const initialNodes = nodesFromInitialBatch(data.batch);

      setSession({
        sessionId: data.session_id,
        nodes: initialNodes,
        status: "idle",
        errorMessage: undefined,
        nextGenerationIndex: 1,
        selectedNodeId: initialNodes[0]?.id,
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
      nodeId,
    }: { sessionId: string; clusterId: string; nodeId: string }) =>
      moreLikeCluster(sessionId, clusterId, { num_clips: NUM_CLIPS }),
    onMutate: () => {
      setSession((prev) => ({
        ...prev,
        status: "loading",
        errorMessage: undefined,
      }));
    },
    onSuccess: (data, vars) => {
      setSession((prev) => {
        const newNodes = nodesFromMoreLike(data.batch, prev.nextGenerationIndex, vars.nodeId);

        return {
          ...prev,
          sessionId: data.session_id,
          nodes: [...prev.nodes, ...newNodes],
          status: "idle",
          errorMessage: undefined,
          nextGenerationIndex: prev.nextGenerationIndex + 1,
          selectedNodeId: vars.nodeId,
        };
      });
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
        errorMessage: message,
      }));
      setControls((prev) => ({ ...prev, errorMessage: message }));
    },
  });

  const handleBriefChange = (brief: string) => {
    setControls((prev) => ({ ...prev, brief }));
  };

  const handleParamsChange = (params: BriefParams) => {
    setControls((prev) => ({ ...prev, params }));
  };

  const handleGenerate = () => {
    const body: CreateSessionRequest = {
      brief: controls.brief,
      num_clips: NUM_CLIPS,
      params: controls.params,
    };
    createSessionMutation.mutate(body);
  };

  const handleMoreLike = (node: NodeView) => {
    const sid = session.sessionId;
    if (!sid) return;

    setSession((prev) => ({ ...prev, selectedNodeId: node.id }));

    moreLikeMutation.mutate({
      sessionId: sid,
      clusterId: node.backendClusterId,
      nodeId: node.id,
    });
  };

  const handleSelectNode = (node: NodeView) => {
    setSession((prev) => ({ ...prev, selectedNodeId: node.id }));
  };

  return (
    <ShellLayout
      sidebar={<Sidebar title="Suno Session Lab" items={[{ id: "create", label: "Create" }]} />}
      main={
        <MainPanel
          left={
            <ControlPanel
              {...controls}
              onBriefChange={handleBriefChange}
              onParamsChange={handleParamsChange}
              onGenerate={handleGenerate}
            />
          }
          right={
            <NodeGrid
              nodes={session.nodes}
              status={session.status}
              onMoreLike={handleMoreLike}
              onPlay={(node) => {
                handleSelectNode(node);
                playTrack(node.track, node.label);
              }}
              selectedNodeId={session.selectedNodeId}
              onSelect={handleSelectNode}
            />
          }
        />
      }
      bottom={<BottomPlayer />}
    />
  );
}

export function App(): ReactElement {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}
