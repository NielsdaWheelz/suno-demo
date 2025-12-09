import React from "react";
import type { BriefParams } from "../types/api";
import type { ControlPanelState } from "../types/ui";

export interface ControlPanelProps extends ControlPanelState {
  onBriefChange: (v: string) => void;
  onNumClipsChange: (v: number) => void;
  onParamsChange: (p: BriefParams) => void;
  onGenerate: () => void;
}

export function ControlPanel(props: ControlPanelProps): JSX.Element {
  const {
    brief,
    numClips,
    params,
    canGenerate,
    loading,
    errorMessage,
    onBriefChange,
    onNumClipsChange,
    onParamsChange,
    onGenerate,
  } = props;

  const clampNumClips = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 1;
    }

    const rounded = Math.round(value);
    return Math.min(6, Math.max(1, rounded));
  };

  const handleBriefChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onBriefChange(event.target.value);
  };

  const handleNumClipsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    onNumClipsChange(clampNumClips(parsed));
  };

  const handleParamChange =
    (key: keyof BriefParams) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      onParamsChange({ ...params, [key]: parsed });
    };

  const disabled = loading || !canGenerate;

  return (
    <div className="space-y-5 rounded-lg border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Song Brief</h2>
      </div>

      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="brief-description"
        >
          Description
        </label>
        <textarea
          id="brief-description"
          className="w-full rounded-md border border-slate-200 p-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          rows={4}
          value={brief}
          onChange={handleBriefChange}
          placeholder="describe the vibe, instruments, mood..."
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="num-clips"
          >
            Number of clips
          </label>
          <input
            id="num-clips"
            type="number"
            min={1}
            max={6}
            step={1}
            className="w-32 rounded-md border border-slate-200 p-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={numClips}
            onChange={handleNumClipsChange}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700">
            <label htmlFor="energy-slider">Energy</label>
            <span className="text-slate-500">{params.energy.toFixed(2)}</span>
          </div>
          <input
            id="energy-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={params.energy}
            onChange={handleParamChange("energy")}
            className="w-full accent-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700">
            <label htmlFor="density-slider">Density</label>
            <span className="text-slate-500">{params.density.toFixed(2)}</span>
          </div>
          <input
            id="density-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={params.density}
            onChange={handleParamChange("density")}
            className="w-full accent-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700">
            <label htmlFor="duration-slider">Duration (sec)</label>
            <span className="text-slate-500">{params.durationSec.toFixed(1)}</span>
          </div>
          <input
            id="duration-slider"
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={params.durationSec}
            onChange={handleParamChange("durationSec")}
            className="w-full accent-indigo-500"
          />
        </div>
      </div>

      {errorMessage ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        type="button"
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        onClick={onGenerate}
        disabled={disabled}
      >
        Generate
      </button>
    </div>
  );
}
