import React from "react";

export interface ShellLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  bottom: React.ReactNode;
}

export function ShellLayout(props: ShellLayoutProps): JSX.Element {
  const { sidebar, main, bottom } = props;

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr] grid-rows-[1fr_72px] bg-slate-950 text-slate-100">
      <aside className="border-r border-slate-800 bg-slate-900">{sidebar}</aside>
      <main className="overflow-y-auto">{main}</main>
      <div className="col-span-2 border-t border-slate-800">{bottom}</div>
    </div>
  );
}
