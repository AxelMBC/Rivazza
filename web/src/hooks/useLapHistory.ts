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

export type SettledLapLog = { lapCount: number; bestLapMs: number };

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
  const lapsRef = useRef<LapRecord[]>([]);
  const lapCountRef = useRef<number | null>(null);
  const lapTimeRef = useRef(0);
  const prevBestRef = useRef(0);
  const prevLastRef = useRef(0);
  const pitAtStartRef = useRef(false);
  const pitDuringRef = useRef(false);
  const pendingRef = useRef<PendingLap | null>(null);
  const cutDuringRef = useRef(false);
  const settledRef = useRef<SettledLapLog>({ lapCount: 0, bestLapMs: 0 });
  const consumedCutsRef = useRef(0);
  const seenCutsRef = useRef<CutEvent[] | null>(null);
  const lastFrameRef = useRef<TelemetryFrame | null>(null);

  useEffect(() => {
    const cuts = cutsRef.current;
    if (cuts !== seenCutsRef.current) {
      seenCutsRef.current = cuts;
      consumedCutsRef.current = 0;
    }

    if (!telemetry) {
      lapsRef.current = [];
      lapCountRef.current = null;
      lapTimeRef.current = 0;
      prevBestRef.current = 0;
      prevLastRef.current = 0;
      pitAtStartRef.current = false;
      pitDuringRef.current = false;
      pendingRef.current = null;
      cutDuringRef.current = false;
      settledRef.current = { lapCount: 0, bestLapMs: 0 };
      return;
    }

    const transition = classifyLapTransition(
      lapCountRef.current,
      lapTimeRef.current,
      telemetry,
    );

    if (transition.kind === "restart") {
      lapsRef.current = [];
      pitDuringRef.current = false;
      pendingRef.current = null;
      cutDuringRef.current = false;
      consumedCutsRef.current = cuts.length;
    } else if (transition.kind === "tick") {
      pendingRef.current = {
        lap: transition.completedLap,
        pitAtStart: pitAtStartRef.current,
        pitDuring: pitDuringRef.current,
        cutDuring: cutDuringRef.current,
        bestBefore: prevBestRef.current,
        lastLapBefore: prevLastRef.current,
        framesWaited: 0,
      };
      pitDuringRef.current = false;
      cutDuringRef.current = false;
    }

    if (transition.kind !== "same") pitAtStartRef.current = telemetry.inPit;

    for (; consumedCutsRef.current < cuts.length; consumedCutsRef.current++) {
      const cut = cuts[consumedCutsRef.current];
      if (cut.lapCount > telemetry.lapCount) break;
      if (cut.lapCount === telemetry.lapCount) {
        cutDuringRef.current = true;
      } else if (
        pendingRef.current &&
        cut.lapCount + 1 === pendingRef.current.lap
      ) {
        pendingRef.current.cutDuring = true;
      }
    }

    const pending = pendingRef.current;
    if (pending) {
      if (isLastLapFresh(telemetry, pending, PENDING_MAX_FRAMES)) {
        const timeMs = telemetry.lastLapMs;
        const wouldBeBest =
          pending.bestBefore <= 0 || timeMs < pending.bestBefore;
        const rejected = wouldBeBest && telemetry.bestLapMs !== timeMs;
        lapsRef.current.push({
          lap: pending.lap,
          timeMs,
          status: settleStatus(pending, rejected),
        });
        pendingRef.current = null;
      } else if (telemetry !== lastFrameRef.current) {
        pending.framesWaited += 1;
      }
    }

    if (!pendingRef.current) {
      settledRef.current = {
        lapCount: telemetry.lapCount,
        bestLapMs: telemetry.bestLapMs,
      };
    }

    pitDuringRef.current = pitDuringRef.current || telemetry.inPit;
    lapCountRef.current = telemetry.lapCount;
    lapTimeRef.current = telemetry.lapTimeMs;
    prevBestRef.current = telemetry.bestLapMs;
    prevLastRef.current = telemetry.lastLapMs;
    lastFrameRef.current = telemetry;
  }, [telemetry, cutsRef, cutSeq]);

  return { lapsRef, currentLapInvalidRef: cutDuringRef, settledRef };
};
