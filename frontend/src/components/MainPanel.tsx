import React from "react";

export interface MainPanelProps {
  children?: React.ReactNode;
}

export function MainPanel(props: MainPanelProps): JSX.Element {
  const { children } = props;

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
    </div>
  );
}
