import type { SessionInfo, TelemetryFrame } from "@rivazza/protocol";
import { useEffect, useRef, useState } from "react";

import { COVERAGE_END, COVERAGE_START } from "../lib/lapAnalysis";

import type { LapRecord } from "./useLapHistory";

export type LapTelemetrySample = {
  pos: number;
  timeMs: number;
  speedKmh: number;
  gas: number;
  brake: number;
  gear: number;
  steerAngle: number;
  x: number;
  z: number;
};

export type LapRecording = {
  lap: number;
  timeMs: number | null;
  complete: boolean;
  samples: LapTelemetrySample[];
};

// 30 laps × 12k samples × ~9 numbers is ~20 MB worst case.
const MAX_RECORDED_LAPS = 30;
// ~3 minutes of lap at the 60 Hz stream rate.
const MAX_LAP_SAMPLES = 12000;
// Counted in raw frames: this hook runs at the full stream rate, not the ~30 Hz state.
const PENDING_MAX_FRAMES = 6;

type PendingRecording = {
  rec: LapRecording;
  overflowed: boolean;
  lastLapBefore: number;
  framesWaited: number;
};

export type LapRecordings = {
  recordingsRef: React.RefObject<LapRecording[]>;
  currentRef: React.RefObject<LapRecording>;
  version: number;
};

const freshLap = (lap: number): LapRecording => ({
  lap,
  timeMs: null,
  complete: false,
  samples: [],
});

export const useLapRecordings = (
  subscribeFrame: (cb: (frame: TelemetryFrame) => void) => () => void,
  session: SessionInfo | null,
  lapsRef: React.RefObject<LapRecord[]>,
): LapRecordings => {
  const recordingsRef = useRef<LapRecording[]>([]);
  const currentRef = useRef<LapRecording>(freshLap(1));
  const [version, setVersion] = useState(0);
  const lapCountRef = useRef<number | null>(null);
  const lapTimeRef = useRef(0);
  const prevLastRef = useRef(0);
  const pendingRef = useRef<PendingRecording | null>(null);
  const overflowedRef = useRef(false);
  const wrappedRef = useRef<{ rec: LapRecording; overflowed: boolean } | null>(
    null,
  );

  useEffect(() => {
    recordingsRef.current = [];
    currentRef.current = freshLap(1);
    lapCountRef.current = null;
    lapTimeRef.current = 0;
    prevLastRef.current = 0;
    pendingRef.current = null;
    overflowedRef.current = false;
    wrappedRef.current = null;
    setVersion((n) => n + 1);
  }, [session]);

  useEffect(() => {
    const onFrame = (frame: TelemetryFrame) => {
      const prevLap = lapCountRef.current;
      const restarted =
        prevLap !== null &&
        (frame.lapCount < prevLap ||
          (frame.lapCount === prevLap &&
            frame.lapTimeMs + 1000 < lapTimeRef.current));

      if (restarted) {
        recordingsRef.current = [];
        currentRef.current = freshLap(frame.lapCount + 1);
        pendingRef.current = null;
        overflowedRef.current = false;
        wrappedRef.current = null;
        setVersion((n) => n + 1);
      } else if (prevLap !== null && frame.lapCount > prevLap) {
        const wrapped = wrappedRef.current;
        wrappedRef.current = null;
        if (wrapped) {
          wrapped.rec.lap = prevLap + 1;
          pendingRef.current = {
            rec: wrapped.rec,
            overflowed: wrapped.overflowed,
            lastLapBefore: prevLastRef.current,
            framesWaited: 0,
          };
          currentRef.current.lap = frame.lapCount + 1;
        } else {
          currentRef.current.lap = prevLap + 1;
          pendingRef.current = {
            rec: currentRef.current,
            overflowed: overflowedRef.current,
            lastLapBefore: prevLastRef.current,
            framesWaited: 0,
          };
          currentRef.current = freshLap(frame.lapCount + 1);
          overflowedRef.current = false;
        }
      } else if (prevLap === null) {
        currentRef.current.lap = frame.lapCount + 1;
      }

      const pending = pendingRef.current;
      if (pending) {
        const fresh =
          frame.lastLapMs > 0 &&
          (frame.lastLapMs !== pending.lastLapBefore ||
            pending.framesWaited >= PENDING_MAX_FRAMES);
        if (fresh) {
          const rec = pending.rec;
          const samples = rec.samples;
          rec.timeMs = frame.lastLapMs;
          rec.complete =
            !pending.overflowed &&
            samples.length >= 2 &&
            samples[0].pos <= COVERAGE_START &&
            samples[samples.length - 1].pos >= COVERAGE_END;
          const recordings = recordingsRef.current;
          recordings.push(rec);
          if (recordings.length > MAX_RECORDED_LAPS) {
            const invalid = new Set(
              lapsRef.current.filter((l) => l.invalid).map((l) => l.lap),
            );
            let best: LapRecording | null = null;
            for (const r of recordings) {
              if (!r.complete || r.timeMs === null || invalid.has(r.lap))
                continue;
              if (best === null || r.timeMs < (best.timeMs ?? Infinity))
                best = r;
            }
            const idx = recordings.findIndex((r) => r !== best);
            recordings.splice(Math.max(0, idx), 1);
          }
          pendingRef.current = null;
          setVersion((n) => n + 1);
        } else {
          pending.framesWaited += 1;
        }
      }

      const cur = currentRef.current;
      const lastSample = cur.samples[cur.samples.length - 1];
      const jumpedBackwardsWithoutTick =
        lastSample !== undefined && frame.normalizedPos < lastSample.pos - 0.5;
      if (jumpedBackwardsWithoutTick) {
        const spansLap =
          cur.samples.length >= 2 &&
          cur.samples[0].pos <= COVERAGE_START &&
          lastSample.pos >= COVERAGE_END;
        wrappedRef.current = spansLap
          ? { rec: cur, overflowed: overflowedRef.current }
          : null;
        currentRef.current = freshLap(frame.lapCount + 1);
        overflowedRef.current = false;
      }

      const samples = currentRef.current.samples;
      const last = samples[samples.length - 1];
      if (!last || frame.normalizedPos > last.pos) {
        if (samples.length < MAX_LAP_SAMPLES) {
          samples.push({
            pos: frame.normalizedPos,
            timeMs: frame.lapTimeMs,
            speedKmh: frame.speedKmh,
            gas: frame.gas,
            brake: frame.brake,
            gear: frame.gear,
            steerAngle: frame.steerAngle,
            x: frame.x,
            z: frame.z,
          });
        } else {
          overflowedRef.current = true;
        }
      }

      lapCountRef.current = frame.lapCount;
      lapTimeRef.current = frame.lapTimeMs;
      prevLastRef.current = frame.lastLapMs;
    };

    return subscribeFrame(onFrame);
  }, [subscribeFrame, lapsRef]);

  return { recordingsRef, currentRef, version };
};
