import { useEffect, useRef, useState } from 'react';
import type { SessionInfo, TelemetryFrame } from '../types';
import type { LapRecord } from './useLapHistory';
import { COVERAGE_START, COVERAGE_END } from '../lib/lapAnalysis';

export type LapTelemetrySample = {
  // normalizedPos — strictly increasing within a lap (glitches are dropped).
  pos: number;
  // lapTimeMs at capture.
  timeMs: number;
  speedKmh: number;
  gas: number;
  brake: number;
  gear: number;
  steerAngle: number;
  // World position, so analysis consumers can point back at the track map.
  x: number;
  z: number;
};

export type LapRecording = {
  // Display lap number — matches the LAP tile convention (lapCount N
  // completes "Lap N+1").
  lap: number;
  // Completed lap time; null while the lap is in progress.
  timeMs: number | null;
  // Samples span the lap (and the per-lap cap never tripped) — only complete
  // recordings are comparable end to end.
  complete: boolean;
  samples: LapTelemetrySample[];
};

// Bounds in the MAX_SAMPLES/MAX_LAPS tradition: hard caps so a marathon
// session (or a stuck lap counter) can't grow memory unbounded. 30 laps ×
// 12k samples × ~9 numbers is ~20 MB worst case.
const MAX_RECORDED_LAPS = 30;
// ~3 minutes of lap at the 60 Hz stream rate; beyond it the lap keeps
// running but stops sampling and is flagged not complete.
const MAX_LAP_SAMPLES = 12000;
// Same freshness discipline as useLapHistory's pending lap, but counted in
// raw frames (this hook runs at the full stream rate, not the ~30 Hz state).
const PENDING_MAX_FRAMES = 6;

type PendingRecording = {
  rec: LapRecording;
  overflowed: boolean;
  // lastLapMs before the lap completed (staleness sentinel).
  lastLapBefore: number;
  framesWaited: number;
};

export type LapRecordings = {
  // Completed recordings, oldest first — a ref, safe for rAF consumers.
  recordingsRef: React.RefObject<LapRecording[]>;
  // The in-progress lap's recording (timeMs null, growing samples).
  currentRef: React.RefObject<LapRecording>;
  // Bumps when recordings are stored or cleared (not per sample) — the
  // re-render signal for React consumers, in the cutSeq tradition.
  version: number;
};

const freshLap = (lap: number): LapRecording => ({
  lap,
  timeMs: null,
  complete: false,
  samples: [],
});

// Session-scoped, position-indexed telemetry recording for every lap driven
// while the app is open. Capture rides the full-rate frame subscription from
// useTelemetry — not the throttled state (blurs brake points by meters at
// speed) and not a rAF loop (throttles while the game-focused browser window
// is occluded). Validity is never re-derived here: consumers join against
// useLapHistory by lap number; it is only consulted for eviction pinning.
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
  // A full-lap trace rolled over at the finish line while lapCount hadn't
  // incremented yet (AC reports the position wrap a frame or two before the
  // counter) — held here for the imminent tick.
  const wrappedRef = useRef<{ rec: LapRecording; overflowed: boolean } | null>(null);

  // Session change (a new session message, including each demo-replay loop)
  // clears everything for the new session.
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
      // Same restart signature as useLapHistory / useLapDelta / TrackMap:
      // AC's "restart session" doesn't re-handshake, so spot it by the lap
      // counter or the current lap time running backwards.
      const restarted =
        prevLap !== null &&
        (frame.lapCount < prevLap ||
          (frame.lapCount === prevLap && frame.lapTimeMs + 1000 < lapTimeRef.current));

      if (restarted) {
        // The in-progress trace is garbage and pre-restart laps no longer exist.
        recordingsRef.current = [];
        currentRef.current = freshLap(frame.lapCount + 1);
        pendingRef.current = null;
        overflowedRef.current = false;
        wrappedRef.current = null;
        setVersion((n) => n + 1);
      } else if (prevLap !== null && frame.lapCount > prevLap) {
        // Lap boundary: hold the finished trace pending until lastLapMs
        // visibly refreshes (or a few frames pass — back-to-back identical
        // lap times never refresh the value). When the trace already rolled
        // over at the line (wrappedRef), the held trace is the finished lap
        // and the current one is already the new lap — keep it recording.
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
            // Evict the oldest, but pin the session-best valid complete lap
            // — it's the reference everything else compares against.
            const invalid = new Set(
              lapsRef.current.filter((l) => l.invalid).map((l) => l.lap),
            );
            let best: LapRecording | null = null;
            for (const r of recordings) {
              if (!r.complete || r.timeMs === null || invalid.has(r.lap)) continue;
              if (best === null || r.timeMs < (best.timeMs ?? Infinity)) best = r;
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

      // A large backwards jump in track position without a lapCount tick.
      // Two cases: (a) the finish-line crossing of a genuinely completed lap
      // whose lapCount increment hasn't arrived yet (AC reports the wrap a
      // frame or two early) — the trace spans the whole lap, hold it for the
      // imminent tick; (b) an out-lap's first line crossing (lapCount stays
      // 0 until a lap completes, so the "current lap" otherwise begins at
      // the pit spawn and the monotonic guard would reject the entire first
      // flying lap) or a teleport — pre-line samples belong to no lap,
      // discard them. Either way a fresh trace starts at the line.
      {
        const cur = currentRef.current;
        const lastSample = cur.samples[cur.samples.length - 1];
        if (lastSample && frame.normalizedPos < lastSample.pos - 0.5) {
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
      }

      // Append-only capture, monotonic in track position — a pos glitch
      // (or a stationary car) adds nothing.
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
