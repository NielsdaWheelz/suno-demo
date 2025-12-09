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
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
          <span>session</span>
          <span>{status}</span>
        </div>

        {errorMessage ? (
          <div
            className="rounded-md border border-red-700 bg-red-900/70 px-3 py-2 text-sm text-red-100"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        {controlPanel}

        {clustersArea}

        {children}
      </div>
    </div>
  );
}
