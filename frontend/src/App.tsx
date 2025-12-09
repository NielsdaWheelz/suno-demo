import React, { useState } from "react";
import { BottomPlayer } from "./components/BottomPlayer";
import { ClusterGrid } from "./components/ClusterGrid";
import { ControlPanel } from "./components/ControlPanel";
import { MainPanel } from "./components/MainPanel";
import { ShellLayout } from "./components/ShellLayout";
import { Sidebar } from "./components/Sidebar";
import type { BriefParams } from "./types/api";
import type { ClusterView, ControlPanelState } from "./types/ui";

const mockClusters: ClusterView[] = [
  {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff",
    label: "bright synthwave",
    tracks: [
      { id: "t1", audio_url: "/mock1.wav", duration_sec: 5 },
      { id: "t2", audio_url: "/mock2.wav", duration_sec: 7 },
    ],
    source: "initial",
  },
  {
    id: "12345678-1234-5678-9999-abcdefabcdef",
    label: "dark drones",
    tracks: [{ id: "t3", audio_url: "/mock3.wav", duration_sec: 4 }],
    source: "more",
    parentClusterId: "aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff",
  },
];

export function App(): JSX.Element {
  const [controls, setControls] = useState<ControlPanelState>({
    brief: "",
    numClips: 3,
    params: { energy: 0.5, density: 0.5, durationSec: 8 },
    canGenerate: true,
    loading: false,
    errorMessage: undefined,
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

  const handleGenerateClick = () => {
    const payload = {
      brief: controls.brief,
      num_clips: controls.numClips,
      params: controls.params,
    };
    console.log("generate payload (stub):", payload);
  };

  return (
    <ShellLayout
      sidebar={
        <Sidebar title="Suno Session Lab" items={[{ id: "create", label: "Create" }]} />
      }
      main={
        <MainPanel>
          <ControlPanel
            {...controls}
            onBriefChange={handleBriefChange}
            onNumClipsChange={handleNumClipsChange}
            onParamsChange={handleParamsChange}
            onGenerate={handleGenerateClick}
          />
          <div className="mt-4">
            <ClusterGrid
              clusters={mockClusters}
              sessionId="mock-session"
              status="idle"
              loadingClusterId={undefined}
              numClips={3}
              onMoreLike={(id) => console.log("moreLike", id)}
              onTrackSelect={(track, label) => console.log("select", track, label)}
            />
          </div>
        </MainPanel>
      }
      bottom={<BottomPlayer />}
    />
  );
}
