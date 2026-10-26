import type { GameState } from "@rivazza/protocol";

import { SHM_STATE } from "./kernel32.js";
import type { LazyPage } from "./lazyPage.js";

// SPageFileGraphic opens with `int packetId`, then `int status`: an AC_STATUS,
// indexed here by its value.
const OFF_PACKET_ID = 0;
const OFF_STATUS = 4;
const READ_SIZE = 8;
const AC_STATUS = ["off", "replay", "live", "paused"] as const;

const POLL_MS = 100;
const FRESH_MS = 2000;

export type RunState = (typeof AC_STATUS)[number];

export type GraphicsSample = { packetId: number; state: RunState };

export const createGraphicsReader = (
  graphics: LazyPage,
): (() => GraphicsSample | null) => {
  const page = Buffer.alloc(READ_SIZE);
  return () => {
    if (!graphics.read(page)) return null;
    const state: RunState | undefined = AC_STATUS[page.readInt32LE(OFF_STATUS)];
    return state ? { packetId: page.readInt32LE(OFF_PACKET_ID), state } : null;
  };
};

export const isHeldState = (state: RunState | null | undefined): boolean =>
  state === "paused" || state === "replay";

export const wireGame = (state: RunState | null): GameState | undefined =>
  state === null || state === "off" ? undefined : state;

export type GameWatch = {
  state: RunState | null;
  packetId: number | null;
  advancedAt: number;
  armed: boolean;
};

export const initialGameWatch = (): GameWatch => ({
  state: null,
  packetId: null,
  advancedAt: -Infinity,
  armed: false,
});

export type GameWatchStep = {
  watch: GameWatch;
  changed: boolean;
  fresh: boolean;
  holdsSession: boolean;
  endsSession: boolean;
};

export const stepGameWatch = (
  watch: GameWatch,
  sample: GraphicsSample | null,
  now: number,
  sessionLive: boolean,
): GameWatchStep => {
  const state = sample?.state ?? null;
  const packetId = sample?.packetId ?? null;
  const advanced =
    packetId !== null && watch.packetId !== null && packetId !== watch.packetId;
  const advancedAt = advanced ? now : watch.advancedAt;
  const fresh = now - advancedAt <= FRESH_MS;
  const armed = sessionLive && (watch.armed || (advanced && state !== "off"));
  const endsSession = armed && state === "off";
  return {
    watch: { state, packetId, advancedAt, armed: armed && !endsSession },
    changed: wireGame(state) !== wireGame(watch.state),
    fresh,
    holdsSession: isHeldState(state) && fresh,
    endsSession,
  };
};

type GameWatchDeps = {
  read: () => GraphicsSample | null;
  isLive: () => boolean;
  onChange: (game: GameState | undefined) => void;
  onOff: () => void;
};

export type GameWatcher = {
  game: () => GameState | undefined;
  holdsSession: () => boolean;
  stop: () => void;
};

export const startGameWatch = (deps: GameWatchDeps): GameWatcher => {
  let last = stepGameWatch(initialGameWatch(), null, 0, false);

  const poll = (): void => {
    last = stepGameWatch(
      last.watch,
      deps.read(),
      performance.now(),
      deps.isLive(),
    );
    if (last.endsSession) deps.onOff();
    else if (last.changed) deps.onChange(wireGame(last.watch.state));
  };

  const pollTimer = SHM_STATE === "enabled" ? setInterval(poll, POLL_MS) : null;

  return {
    game: () => wireGame(last.watch.state),
    holdsSession: () => last.holdsSession,
    stop: () => {
      if (pollTimer) clearInterval(pollTimer);
    },
  };
};
