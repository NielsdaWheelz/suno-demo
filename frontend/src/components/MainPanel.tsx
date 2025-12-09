import type { ReactElement, ReactNode } from "react";
import type { SessionStatus } from "../types/ui";

export interface MainPanelProps {
  controlPanel: ReactNode;
  clustersArea: ReactNode;
  status: SessionStatus;
  errorMessage?: string;
  children?: ReactNode;
}

export function MainPanel(props: MainPanelProps): ReactElement {
  const { controlPanel, clustersArea, status, errorMessage, children } = props;

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {errorMessage ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        {controlPanel}

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Results</h2>
            <div className="text-xs uppercase tracking-wide text-slate-500">{status}</div>
          </div>
          {clustersArea}
        </div>

        {children}
      </div>
    </div>
  );
}
