import {
  PROTOCOL_VERSION,
  type BridgeMessage,
  type GameState,
  type SessionInfo,
} from "@rivazza/protocol";

import { resolveCarTopSpeed } from "./content/carAssets.js";
import {
  resolveTrackAssetsForSession,
  type ReadLayoutTokens,
  type TrackAssets,
} from "./content/trackAssets.js";
import type { HandshakerResponse } from "./udp/parsers.js";

export type Session = {
  start: (handshake: HandshakerResponse) => Promise<boolean>;
  end: () => void;
  isLive: () => boolean;
  status: () => BridgeMessage;
  greeting: () => BridgeMessage[];
};

export const createSession = (
  readLayoutTokens: ReadLayoutTokens,
  readGame: () => GameState | undefined,
): Session => {
  let current: SessionInfo | null = null;
  let generation = 0;

  const status = (): BridgeMessage =>
    current
      ? {
          type: "status",
          state: "connected",
          protocol: PROTOCOL_VERSION,
          game: readGame(),
        }
      : { type: "status", state: "waiting", protocol: PROTOCOL_VERSION };

  const resolveAssets = async (
    handshake: HandshakerResponse,
  ): Promise<TrackAssets | null> => {
    try {
      return await resolveTrackAssetsForSession(
        handshake.trackName,
        handshake.trackConfig,
        readLayoutTokens,
      );
    } catch (err) {
      console.warn(
        "[map] track asset resolution failed:",
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  };

  return {
    start: async (handshake) => {
      const startedAt = ++generation;
      current = null;
      const assets = await resolveAssets(handshake);
      if (startedAt !== generation) return false;
      current = {
        track: handshake.trackName,
        trackConfig: handshake.trackConfig,
        car: handshake.carName,
        driver: handshake.driverName,
        meta: assets?.meta ?? null,
        edges: assets?.edges ?? null,
        topSpeedKmh: resolveCarTopSpeed(handshake.carName),
      };
      return true;
    },
    end: () => {
      generation++;
      current = null;
    },
    isLive: () => current !== null,
    status,
    greeting: () =>
      current ? [status(), { type: "session", ...current }] : [status()],
  };
};
