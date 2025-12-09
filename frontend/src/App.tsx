import React from "react";
import { BottomPlayer } from "./components/BottomPlayer";
import { MainPanel } from "./components/MainPanel";
import { ShellLayout } from "./components/ShellLayout";
import { Sidebar } from "./components/Sidebar";

const sidebarItems = [
  { id: "home", label: "Home" },
  { id: "create", label: "Create" },
  { id: "library", label: "Library" },
];

export function App(): JSX.Element {
  return (
    <ShellLayout
      sidebar={<Sidebar title="Suno Session Lab" items={sidebarItems} />}
      main={
        <MainPanel>
          <div>main content placeholder</div>
        </MainPanel>
      }
      bottom={<BottomPlayer />}
    />
  );
}
