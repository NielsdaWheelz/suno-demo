import type { ChangeEvent, ReactElement } from "react";
import type { BriefParams } from "../types/api";
import type { ControlPanelState } from "../types/ui";

export interface ControlPanelProps extends ControlPanelState {
  onBriefChange: (v: string) => void;
  onParamsChange: (p: BriefParams) => void;
  onGenerate: () => void;
  onForceInstrumentalChange: (v: boolean) => void;
}

export function ControlPanel(props: ControlPanelProps): ReactElement {
  const {
    brief,
    params,
    canGenerate,
    loading,
    errorMessage,
    onBriefChange,
    onParamsChange,
    onGenerate,
    forceInstrumental,
    onForceInstrumentalChange,
  } = props;

  const handleBriefChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onBriefChange(event.target.value);
  };

  const handleParamChange =
    (key: keyof BriefParams) => (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      onParamsChange({ ...params, [key]: parsed });
    };

  const handleForceInstrumentalChange = (event: ChangeEvent<HTMLInputElement>) => {
    onForceInstrumentalChange(event.target.checked);
  };

  const disabled = loading || !canGenerate;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Song brief</h2>
          <span className="text-xs uppercase tracking-wide text-slate-500">setup</span>
        </div>

        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-slate-200"
            htmlFor="brief-description"
          >
            description
          </label>
          <textarea
            id="brief-description"
            className="w-full min-h-[96px] rounded-md border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            rows={4}
            value={brief}
            onChange={handleBriefChange}
            placeholder="describe the vibe, instruments, mood..."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-slate-200">
                <label htmlFor="energy-slider">energy</label>
                <span className="text-slate-400">{params.energy.toFixed(2)}</span>
              </div>
              <input
                id="energy-slider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={params.energy}
                onChange={handleParamChange("energy")}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-slate-200">
                <label htmlFor="density-slider">density</label>
                <span className="text-slate-400">{params.density.toFixed(2)}</span>
              </div>
              <input
                id="density-slider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={params.density}
                onChange={handleParamChange("density")}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-slate-200">
                <label htmlFor="duration-slider">duration (sec)</label>
                <span className="text-slate-400">{params.duration_sec.toFixed(1)}</span>
              </div>
              <input
                id="duration-slider"
                type="range"
                min={1}
                max={60}
                step={0.5}
                value={params.duration_sec}
                onChange={handleParamChange("duration_sec")}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-slate-200">
                <label htmlFor="tempo-slider">tempo (bpm)</label>
                <span className="text-slate-400">{params.tempo_bpm.toFixed(0)}</span>
              </div>
              <input
                id="tempo-slider"
                type="range"
                min={60}
                max={180}
                step={1}
                value={params.tempo_bpm}
                onChange={handleParamChange("tempo_bpm")}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-slate-200">
                <label htmlFor="brightness-slider">brightness</label>
                <span className="text-slate-400">{params.brightness.toFixed(2)}</span>
              </div>
              <input
                id="brightness-slider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={params.brightness}
                onChange={handleParamChange("brightness")}
                className="w-full accent-sky-500"
              />
            </div>
          </div>

        </div>

        {errorMessage ? (
          <div
            className="rounded-md border border-red-700 bg-red-900/70 px-3 py-2 text-sm text-red-100"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-200" htmlFor="force-instrumental">
            <input
              id="force-instrumental"
              type="checkbox"
              checked={forceInstrumental}
              onChange={handleForceInstrumentalChange}
              className="h-4 w-4 accent-sky-500"
            />
            instrumental only
          </label>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onGenerate}
            disabled={disabled}
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin text-slate-100"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span>Generating...</span>
              </>
            ) : (
              <span>Generate</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
