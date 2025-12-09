import React, { useState } from "react";
import { BottomPlayer } from "./components/BottomPlayer";
import { ControlPanel } from "./components/ControlPanel";
import { MainPanel } from "./components/MainPanel";
import { ShellLayout } from "./components/ShellLayout";
import { Sidebar } from "./components/Sidebar";
import type { BriefParams } from "./types/api";
import type { ControlPanelState } from "./types/ui";

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
          <div data-testid="results-placeholder" className="mt-4 text-slate-400">
            results will appear here
          </div>
        </MainPanel>
      }
      bottom={<BottomPlayer />}
    />
  );
}
