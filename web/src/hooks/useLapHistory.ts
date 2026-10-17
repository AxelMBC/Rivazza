import type { CutEvent, TelemetryFrame } from "@rivazza/protocol";
import { useEffect, useRef } from "react";

import { classifyLapTransition, isLastLapFresh } from "../lib/lapTransition";

export const LAP_STATUS = {
  valid: "valid",
  invalid: "invalid",
  out: "out",
  in: "in",
} as const;

export type LapStatus = (typeof LAP_STATUS)[keyof typeof LAP_STATUS];

export type LapRecord = {
  lap: number;
  timeMs: number;
  status: LapStatus;
};

type PendingLap = {
  lap: number;
  pitAtStart: boolean;
  pitDuring: boolean;
  cutDuring: boolean;
  bestBefore: number;
  lastLapBefore: number;
  framesWaited: number;
};

// Back-to-back identical lap times never visibly refresh lastLapMs.
const PENDING_MAX_FRAMES = 3;

const settleStatus = (pending: PendingLap, rejected: boolean): LapStatus => {
  if (pending.cutDuring) return LAP_STATUS.invalid;
  if (pending.pitDuring)
    return pending.pitAtStart ? LAP_STATUS.out : LAP_STATUS.in;
  if (rejected) return LAP_STATUS.invalid;
  return LAP_STATUS.valid;
};

const settleLap = (pending: PendingLap, frame: TelemetryFrame): LapRecord => {
  const timeMs = frame.lastLapMs;
  const wouldBeBest = pending.bestBefore <= 0 || timeMs < pending.bestBefore;
  const rejected = wouldBeBest && frame.bestLapMs !== timeMs;
  return { lap: pending.lap, timeMs, status: settleStatus(pending, rejected) };
};

export type SettledLapLog = { lapCount: number; bestLapMs: number };

export type LapLogState = {
  laps: LapRecord[];
  lapCount: number | null;
  lapTimeMs: number;
  prevBestMs: number;
  prevLastMs: number;
  pitAtStart: boolean;
  pitDuring: boolean;
  pending: PendingLap | null;
  cutDuring: boolean;
  settled: SettledLapLog;
  consumedCuts: number;
  seenCuts: readonly CutEvent[] | null;
  lastFrame: TelemetryFrame | null;
};

export const initialLapLog = (): LapLogState => ({
  laps: [],
  lapCount: null,
  lapTimeMs: 0,
  prevBestMs: 0,
  prevLastMs: 0,
  pitAtStart: false,
  pitDuring: false,
  pending: null,
  cutDuring: false,
  settled: { lapCount: 0, bestLapMs: 0 },
  consumedCuts: 0,
  seenCuts: null,
  lastFrame: null,
});

export const stepLapLog = (
  state: LapLogState,
  frame: TelemetryFrame | null,
  cuts: readonly CutEvent[],
): LapLogState => {
  let consumedCuts = cuts === state.seenCuts ? state.consumedCuts : 0;

  if (!frame)
    return {
      ...initialLapLog(),
      consumedCuts,
      seenCuts: cuts,
      lastFrame: state.lastFrame,
    };

  let { laps, pitAtStart, pitDuring, pending, cutDuring, settled } = state;
  const transition = classifyLapTransition(
    state.lapCount,
    state.lapTimeMs,
    frame,
  );

  if (transition.kind === "restart") {
    laps = [];
    pitDuring = false;
    pending = null;
    cutDuring = false;
    consumedCuts = cuts.length;
  } else if (transition.kind === "tick") {
    pending = {
      lap: transition.completedLap,
      pitAtStart,
      pitDuring,
      cutDuring,
      bestBefore: state.prevBestMs,
      lastLapBefore: state.prevLastMs,
      framesWaited: 0,
    };
    pitDuring = false;
    cutDuring = false;
  }

  if (transition.kind !== "same") pitAtStart = frame.inPit;

  for (; consumedCuts < cuts.length; consumedCuts++) {
    const cut = cuts[consumedCuts];
    if (cut.lapCount > frame.lapCount) break;
    if (cut.lapCount === frame.lapCount) cutDuring = true;
    else if (pending && cut.lapCount + 1 === pending.lap)
      pending = { ...pending, cutDuring: true };
  }

  if (pending) {
    if (isLastLapFresh(frame, pending, PENDING_MAX_FRAMES)) {
      laps = [...laps, settleLap(pending, frame)];
      pending = null;
    } else if (frame !== state.lastFrame) {
      pending = { ...pending, framesWaited: pending.framesWaited + 1 };
    }
  }

  if (!pending)
    settled = { lapCount: frame.lapCount, bestLapMs: frame.bestLapMs };

  return {
    laps,
    lapCount: frame.lapCount,
    lapTimeMs: frame.lapTimeMs,
    prevBestMs: frame.bestLapMs,
    prevLastMs: frame.lastLapMs,
    pitAtStart,
    pitDuring: pitDuring || frame.inPit,
    pending,
    cutDuring,
    settled,
    consumedCuts,
    seenCuts: cuts,
    lastFrame: frame,
  };
};

export type LapHistory = {
  lapsRef: React.RefObject<LapRecord[]>;
  currentLapInvalidRef: React.RefObject<boolean>;
  settledRef: React.RefObject<SettledLapLog>;
};

export const useLapHistory = (
  telemetry: TelemetryFrame | null,
  cutsRef: React.RefObject<CutEvent[]>,
  cutSeq: number,
): LapHistory => {
  const logRef = useRef<LapLogState | null>(null);
  const lapsRef = useRef<LapRecord[]>([]);
  const currentLapInvalidRef = useRef(false);
  const settledRef = useRef<SettledLapLog>({ lapCount: 0, bestLapMs: 0 });

  useEffect(() => {
    const log = stepLapLog(
      logRef.current ?? initialLapLog(),
      telemetry,
      cutsRef.current,
    );
    logRef.current = log;
    lapsRef.current = log.laps;
    currentLapInvalidRef.current = log.cutDuring;
    settledRef.current = log.settled;
  }, [telemetry, cutsRef, cutSeq]);

  return { lapsRef, currentLapInvalidRef, settledRef };
};
