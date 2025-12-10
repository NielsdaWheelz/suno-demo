import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { TrackOut } from "../types/api";

export type PlayerContextValue = {
  currentTrack?: { track: TrackOut; clusterLabel: string };
  playTrack: (track: TrackOut, clusterLabel: string) => void;
};

export const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return ctx;
}

export interface PlayerProviderProps {
  children: ReactNode;
}

export function PlayerProvider({ children }: PlayerProviderProps): ReactElement {
  const [currentTrack, setCurrentTrack] = useState<{ track: TrackOut; clusterLabel: string } | undefined>(
    undefined,
  );

  const playTrack = useCallback((track: TrackOut, clusterLabel: string) => {
    setCurrentTrack({ track, clusterLabel });
  }, []);

  const value: PlayerContextValue = { currentTrack, playTrack };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
