import type { CutEvent, TelemetryFrame } from "@rivazza/protocol";

import {
  MAX_LAPS,
  MAX_SAMPLES,
  SAMPLE_SPACING,
  TELEPORT_DIST,
} from "./constants";

export type Sample = {
  x: number;
  z: number;
  gas: number;
  brake: number;
  speedKmh: number;
  gear: number;
  jump: boolean;
};
export type CutMarker = { x: number; z: number };
export type StoredLap = {
  lap: number;
  samples: Sample[];
  cut: CutMarker | null;
  path?: Path2D;
};

const freshBounds = () => ({
  minX: Infinity,
  maxX: -Infinity,
  minZ: Infinity,
  maxZ: -Infinity,
});

// Line state outlives the render effect, which re-runs when map data arrives
// mid-session: recreating the lap counter there would miss a lap completion.
export const createLineRecorder = () => {
  const currentRef = { current: [] as Sample[] };
  const previousLapsRef = { current: [] as StoredLap[] };
  const currentCutRef: { current: CutMarker | null } = { current: null };
  const boundsRef = { current: freshBounds() };
  const anchorRef: { current: { x: number; z: number } | null } = {
    current: null,
  };
  let lap: number | null = null;
  let lapTime = 0;
  let consumedCuts = 0;
  let seenCuts: CutEvent[] | null = null;
  // Counts every mutation of previousLapsRef (push/shift/reset) because at
  // MAX_LAPS a rollover keeps the array length constant.
  let lapsVersion = 0;

  const reset = () => {
    currentRef.current = [];
    previousLapsRef.current = [];
    currentCutRef.current = null;
    lap = null;
    lapTime = 0;
    boundsRef.current = freshBounds();
    anchorRef.current = null;
  };

  const ingest = (
    frame: TelemetryFrame,
    cutList: CutEvent[],
    onRestart: () => void,
  ) => {
    const prevLap = lap;
    // AC's "restart session" doesn't re-handshake — spot it by the lap
    // counter or the current lap time running backwards.
    const restarted =
      prevLap !== null &&
      (frame.lapCount < prevLap ||
        (frame.lapCount === prevLap && frame.lapTimeMs + 1000 < lapTime));
    if (restarted) {
      onRestart();
      lapsVersion++;
      // Unconsumed pre-restart cuts reference laps that no longer exist.
      consumedCuts = cutList.length;
    } else if (prevLap !== null && frame.lapCount > prevLap) {
      // Lap finished: keep it among the grey reference lines underneath.
      // Display convention matches the LAP tile: lapCount N is "Lap N+1".
      previousLapsRef.current.push({
        lap: prevLap + 1,
        samples: currentRef.current,
        cut: currentCutRef.current,
      });
      if (previousLapsRef.current.length > MAX_LAPS)
        previousLapsRef.current.shift();
      currentRef.current = [];
      currentCutRef.current = null;
      lapsVersion++;
    }
    lap = frame.lapCount;
    lapTime = frame.lapTimeMs;

    // Attach newly arrived cuts: the in-progress lap takes the first one,
    // a just-completed stored lap picks up a boundary straggler, and
    // everything else is dropped — a later cut for a lap that already died
    // (the tyres-out counter chatters across one excursion), or a
    // pre-restart leftover matching no lap at all.
    if (cutList !== seenCuts) {
      seenCuts = cutList;
      consumedCuts = 0;
    }
    for (; consumedCuts < cutList.length; consumedCuts++) {
      const cut = cutList[consumedCuts];
      if (cut.lapCount === frame.lapCount) {
        currentCutRef.current ??= { x: cut.x, z: cut.z };
      } else {
        const stored = previousLapsRef.current.find(
          (l) => l.lap === cut.lapCount + 1,
        );
        if (stored) stored.cut ??= { x: cut.x, z: cut.z };
      }
    }

    const samples = currentRef.current;
    const last = samples[samples.length - 1];
    const moved = last
      ? Math.hypot(frame.x - last.x, frame.z - last.z)
      : Infinity;
    if (samples.length < MAX_SAMPLES && moved > SAMPLE_SPACING) {
      if (!anchorRef.current) anchorRef.current = { x: frame.x, z: frame.z };
      samples.push({
        x: frame.x,
        z: frame.z,
        gas: frame.gas,
        brake: frame.brake,
        speedKmh: frame.speedKmh,
        gear: frame.gear,
        jump: !!last && moved > TELEPORT_DIST,
      });
      const b = boundsRef.current;
      b.minX = Math.min(b.minX, frame.x);
      b.maxX = Math.max(b.maxX, frame.x);
      b.minZ = Math.min(b.minZ, frame.z);
      b.maxZ = Math.max(b.maxZ, frame.z);
    }
  };

  return {
    currentRef,
    previousLapsRef,
    currentCutRef,
    boundsRef,
    anchorRef,
    lapsVersion: () => lapsVersion,
    reset,
    ingest,
  };
};
