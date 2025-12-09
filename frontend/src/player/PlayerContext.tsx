import React from "react";
import type { TrackOut } from "../types/api";

export type PlayerContextValue = {
  currentTrack?: { track: TrackOut; clusterLabel: string };
  playTrack: (track: TrackOut, clusterLabel: string) => void;
};

export const PlayerContext = React.createContext<PlayerContextValue | undefined>(undefined);

export function usePlayer(): PlayerContextValue {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return ctx;
}

export interface PlayerProviderProps {
  children: React.ReactNode;
}

export function PlayerProvider({ children }: PlayerProviderProps): JSX.Element {
  const [currentTrack, setCurrentTrack] = React.useState<
    { track: TrackOut; clusterLabel: string } | undefined
  >(undefined);

  const playTrack = React.useCallback((track: TrackOut, clusterLabel: string) => {
    setCurrentTrack({ track, clusterLabel });
  }, []);

  const value: PlayerContextValue = { currentTrack, playTrack };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
