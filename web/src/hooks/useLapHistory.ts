import { useEffect, useRef } from 'react';
import type { TelemetryFrame } from '../types';

export type LapRecord = {
  // Display lap number — matches the LAP tile convention (lapCount N completes "Lap N+1").
  lap: number;
  timeMs: number;
  invalid: boolean;
};

// The frame that increments lapCount may still carry the previous lap's
// lastLapMs, so a completed lap is held pending until the value visibly
// refreshes — or a few frames pass and the current value is trusted as-is
// (covers back-to-back identical lap times).
type PendingLap = {
  lap: number;
  pitDuring: boolean;
  bestBefore: number; // bestLapMs in effect before the lap completed
  lastLapBefore: number; // lastLapMs before the lap completed (staleness sentinel)
  framesWaited: number;
};

const PENDING_MAX_FRAMES = 3;

// Session lap log accumulated from the telemetry stream — AC's remote
// telemetry protocol sends no lap list, so laps are recorded as lapCount
// ticks up, and only laps driven while the app is open exist. Validity is
// heuristic (the protocol has no invalid flag): a lap is invalid when it
// beat the best but the game didn't adopt it (a cut would-be-PB), or when
// it touched the pit lane. Cut laps slower than best read as valid.
// Exposed as a ref so the track map can read it from its rAF loop.
export const useLapHistory = (
  telemetry: TelemetryFrame | null,
): React.RefObject<LapRecord[]> => {
  const lapsRef = useRef<LapRecord[]>([]);
  const lapCountRef = useRef<number | null>(null);
  const lapTimeRef = useRef(0);
  const prevBestRef = useRef(0);
  const prevLastRef = useRef(0);
  const pitDuringRef = useRef(false);
  const pendingRef = useRef<PendingLap | null>(null);

  useEffect(() => {
    if (!telemetry) {
      lapsRef.current = [];
      lapCountRef.current = null;
      lapTimeRef.current = 0;
      prevBestRef.current = 0;
      prevLastRef.current = 0;
      pitDuringRef.current = false;
      pendingRef.current = null;
      return;
    }

    const prevLap = lapCountRef.current;
    // Same restart signature as the track map: AC's "restart session"
    // doesn't re-handshake, so spot it by the lap counter or the current
    // lap time running backwards.
    const restarted =
      prevLap !== null &&
      (telemetry.lapCount < prevLap ||
        (telemetry.lapCount === prevLap && telemetry.lapTimeMs + 1000 < lapTimeRef.current));

    if (restarted) {
      lapsRef.current = [];
      pitDuringRef.current = false;
      pendingRef.current = null;
    } else if (prevLap !== null && telemetry.lapCount > prevLap) {
      pendingRef.current = {
        lap: prevLap + 1,
        pitDuring: pitDuringRef.current,
        bestBefore: prevBestRef.current,
        lastLapBefore: prevLastRef.current,
        framesWaited: 0,
      };
      pitDuringRef.current = false;
    }

    const pending = pendingRef.current;
    if (pending) {
      const fresh =
        telemetry.lastLapMs > 0 &&
        (telemetry.lastLapMs !== pending.lastLapBefore ||
          pending.framesWaited >= PENDING_MAX_FRAMES);
      if (fresh) {
        const timeMs = telemetry.lastLapMs;
        // A would-be best the game didn't adopt means it rejected the lap.
        const wouldBeBest = pending.bestBefore <= 0 || timeMs < pending.bestBefore;
        const rejected = wouldBeBest && telemetry.bestLapMs !== timeMs;
        lapsRef.current.push({
          lap: pending.lap,
          timeMs,
          invalid: pending.pitDuring || rejected,
        });
        pendingRef.current = null;
      } else {
        pending.framesWaited += 1;
      }
    }

    pitDuringRef.current = pitDuringRef.current || telemetry.inPit;
    lapCountRef.current = telemetry.lapCount;
    lapTimeRef.current = telemetry.lapTimeMs;
    prevBestRef.current = telemetry.bestLapMs;
    prevLastRef.current = telemetry.lastLapMs;
  }, [telemetry]);

  return lapsRef;
};
