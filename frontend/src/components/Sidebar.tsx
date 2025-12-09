import React from "react";

export interface SidebarProps {
  title: string;
  items: { id: string; label: string }[];
}

export function Sidebar(props: SidebarProps): JSX.Element {
  const { title, items } = props;

  return (
    <div className="flex h-full flex-col gap-6 bg-slate-900 px-5 py-6 text-slate-100">
      <div className="text-lg font-semibold">{title}</div>
      <nav>
        <ul className="flex flex-col gap-3 text-sm text-slate-300">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md px-3 py-2 transition-colors hover:bg-slate-800/80"
            >
              {item.label}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
