import type { ReactElement } from "react";

export interface ShellLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  bottom: React.ReactNode;
}

export function ShellLayout(props: ShellLayoutProps): ReactElement {
  const { sidebar, main, bottom } = props;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)] grid-rows-[1fr_auto]">
        <aside className="border-r border-slate-800 bg-slate-950/90">{sidebar}</aside>
        <main className="overflow-y-auto">{main}</main>
        <div className="col-span-2 border-t border-slate-800 bg-slate-950/95">{bottom}</div>
      </div>
    </div>
  );
}
