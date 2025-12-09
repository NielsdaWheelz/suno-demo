import React from "react";

export interface MainPanelProps {
  left: React.ReactNode; // control panel (prompt + sliders + generate)
  right: React.ReactNode; // generations pane (trail bar + cluster grid)
}

export function MainPanel({ left, right }: MainPanelProps): JSX.Element {
  return (
    <div className="h-full grid grid-cols-[minmax(260px,340px)_1fr] gap-4 p-4">
      <div className="overflow-y-auto">{left}</div>
      <div className="overflow-y-auto">{right}</div>
    </div>
  );
}
