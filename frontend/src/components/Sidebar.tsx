import type { ReactElement } from "react";

export interface SidebarProps {
  title: string;
  items: { id: string; label: string }[];
}

export function Sidebar(props: SidebarProps): ReactElement {
  const { title, items } = props;

  return (
    <div className="flex h-full flex-col gap-4 border-r border-slate-800 bg-slate-950/90 px-4 py-4">
      <div className="text-lg font-semibold text-slate-100">{title}</div>
      <div className="h-px w-full bg-slate-800/80" />
      <nav>
        <ul className="flex flex-col gap-2 text-sm text-slate-300">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md px-3 py-2 transition hover:bg-slate-800/60 hover:text-slate-50"
            >
              {item.label}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
