import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { CutEvent, TelemetryFrame } from "@rivazza/protocol";

import { loadDemoRecording } from "../lib/demoRecording.testkit";

import { initialLapLog, stepLapLog, type LapLogState } from "./useLapHistory";

const frame = (fields: Partial<TelemetryFrame>): TelemetryFrame => ({
  speedKmh: 0,
  gear: 0,
  rpm: 0,
  lapTimeMs: 0,
  lastLapMs: 0,
  bestLapMs: 0,
  lapCount: 0,
  gas: 0,
  brake: 0,
  clutch: 0,
  steerAngle: 0,
  accGFrontal: 0,
  accGHorizontal: 0,
  accGVertical: 0,
  absEnabled: false,
  absInAction: false,
  tcEnabled: false,
  tcInAction: false,
  inPit: false,
  engineLimiterOn: false,
  carSlope: 0,
  tyreSlip: [0, 0, 0, 0],
  wheelLoad: [0, 0, 0, 0],
  normalizedPos: 0,
  x: 0,
  y: 0,
  z: 0,
  ...fields,
});

const cut = (lapCount: number): CutEvent => ({
  lapCount,
  lapTimeMs: 0,
  x: 0,
  z: 0,
  speedKmh: 100,
  tyresOut: 4,
});

const drive = (
  frames: readonly TelemetryFrame[],
  cuts: readonly CutEvent[] = [],
  from: LapLogState = initialLapLog(),
): LapLogState => frames.reduce((s, f) => stepLapLog(s, f, cuts), from);

describe("lap log", () => {
  test("a lap counter tick settles the completed lap with the time it reports", () => {
    const log = drive([
      frame({ lapCount: 0, lapTimeMs: 1000 }),
      frame({ lapCount: 0, lapTimeMs: 89000 }),
      frame({ lapCount: 1, lapTimeMs: 10, lastLapMs: 90000, bestLapMs: 90000 }),
    ]);
    assert.deepEqual(log.laps, [{ lap: 1, timeMs: 90000, status: "valid" }]);
    assert.deepEqual(log.settled, { lapCount: 1, bestLapMs: 90000 });
  });

  test("a lap time that arrives after the tick settles then, and the settled best waits for it", () => {
    const pending = drive([
      frame({ lapCount: 0, lapTimeMs: 89000 }),
      frame({ lapCount: 1, lapTimeMs: 10 }),
    ]);
    assert.deepEqual(pending.laps, []);
    assert.deepEqual(pending.settled, { lapCount: 0, bestLapMs: 0 });

    const log = drive(
      [
        frame({
          lapCount: 1,
          lapTimeMs: 26,
          lastLapMs: 90000,
          bestLapMs: 90000,
        }),
      ],
      [],
      pending,
    );
    assert.deepEqual(log.laps, [{ lap: 1, timeMs: 90000, status: "valid" }]);
    assert.deepEqual(log.settled, { lapCount: 1, bestLapMs: 90000 });
  });

  test("a lap timed identically to the one before settles after three new frames", () => {
    const repeat = frame({
      lapCount: 2,
      lapTimeMs: 10,
      lastLapMs: 90000,
      bestLapMs: 90000,
    });
    const ticked = drive([
      frame({
        lapCount: 1,
        lapTimeMs: 89000,
        lastLapMs: 90000,
        bestLapMs: 90000,
      }),
      repeat,
      repeat,
      repeat,
    ]);
    assert.equal(ticked.laps.length, 0);
    assert.equal(ticked.pending?.framesWaited, 1);

    const log = drive(
      [
        frame({
          lapCount: 2,
          lapTimeMs: 26,
          lastLapMs: 90000,
          bestLapMs: 90000,
        }),
        frame({
          lapCount: 2,
          lapTimeMs: 42,
          lastLapMs: 90000,
          bestLapMs: 90000,
        }),
        frame({
          lapCount: 2,
          lapTimeMs: 58,
          lastLapMs: 90000,
          bestLapMs: 90000,
        }),
      ],
      [],
      ticked,
    );
    assert.deepEqual(log.laps, [{ lap: 2, timeMs: 90000, status: "valid" }]);
  });

  test("a lap started in the pit is an out lap, and a lap that enters it is an in lap", () => {
    const log = drive([
      frame({ lapCount: 0, lapTimeMs: 1000, inPit: true }),
      frame({ lapCount: 0, lapTimeMs: 20000 }),
      frame({
        lapCount: 1,
        lapTimeMs: 10,
        lastLapMs: 100000,
        bestLapMs: 100000,
      }),
      frame({
        lapCount: 1,
        lapTimeMs: 50000,
        lastLapMs: 100000,
        bestLapMs: 100000,
      }),
      frame({
        lapCount: 1,
        lapTimeMs: 90000,
        lastLapMs: 100000,
        bestLapMs: 100000,
        inPit: true,
      }),
      frame({
        lapCount: 2,
        lapTimeMs: 10,
        lastLapMs: 95000,
        bestLapMs: 95000,
        inPit: true,
      }),
    ]);
    assert.deepEqual(log.laps, [
      { lap: 1, timeMs: 100000, status: "out" },
      { lap: 2, timeMs: 95000, status: "in" },
    ]);
  });

  test("a cut on the lap being driven marks it invalid live and when it settles", () => {
    const cuts = [cut(0)];
    const live = drive([frame({ lapCount: 0, lapTimeMs: 30000 })], cuts);
    assert.equal(live.cutDuring, true);

    const log = drive(
      [
        frame({
          lapCount: 1,
          lapTimeMs: 10,
          lastLapMs: 90000,
          bestLapMs: 90000,
        }),
      ],
      cuts,
      live,
    );
    assert.deepEqual(log.laps, [{ lap: 1, timeMs: 90000, status: "invalid" }]);
    assert.equal(log.cutDuring, false);
  });

  test("a cut stamped with the previous lap while it is still settling invalidates that lap", () => {
    const cuts: CutEvent[] = [];
    const tick = frame({ lapCount: 1, lapTimeMs: 10 });
    const pending = drive(
      [frame({ lapCount: 0, lapTimeMs: 89000 }), tick],
      cuts,
    );
    cuts.push(cut(0));
    const withCut = stepLapLog(pending, tick, cuts);
    assert.equal(withCut.cutDuring, false);

    const log = drive(
      [
        frame({
          lapCount: 1,
          lapTimeMs: 26,
          lastLapMs: 90000,
          bestLapMs: 90000,
        }),
      ],
      cuts,
      withCut,
    );
    assert.deepEqual(log.laps, [{ lap: 1, timeMs: 90000, status: "invalid" }]);
  });

  test("a would-be best lap the game did not adopt as its best is invalid", () => {
    const log = drive([
      frame({ lapCount: 0, lapTimeMs: 89000 }),
      frame({ lapCount: 1, lapTimeMs: 10, lastLapMs: 90000, bestLapMs: 90000 }),
      frame({
        lapCount: 1,
        lapTimeMs: 84000,
        lastLapMs: 90000,
        bestLapMs: 90000,
      }),
      frame({ lapCount: 2, lapTimeMs: 10, lastLapMs: 85000, bestLapMs: 90000 }),
      frame({
        lapCount: 2,
        lapTimeMs: 91000,
        lastLapMs: 85000,
        bestLapMs: 90000,
      }),
      frame({ lapCount: 3, lapTimeMs: 10, lastLapMs: 92000, bestLapMs: 90000 }),
    ]);
    assert.deepEqual(log.laps, [
      { lap: 1, timeMs: 90000, status: "valid" },
      { lap: 2, timeMs: 85000, status: "invalid" },
      { lap: 3, timeMs: 92000, status: "valid" },
    ]);
  });

  test("a restart clears the log and leaves earlier cuts behind", () => {
    const cuts = [cut(0)];
    const beforeRestart = drive(
      [
        frame({ lapCount: 0, lapTimeMs: 30000 }),
        frame({
          lapCount: 1,
          lapTimeMs: 10,
          lastLapMs: 90000,
          bestLapMs: 90000,
        }),
        frame({
          lapCount: 1,
          lapTimeMs: 40000,
          lastLapMs: 90000,
          bestLapMs: 90000,
        }),
      ],
      cuts,
    );
    assert.equal(beforeRestart.laps.length, 1);

    const log = drive(
      [
        frame({ lapCount: 0, lapTimeMs: 500 }),
        frame({ lapCount: 0, lapTimeMs: 88000 }),
        frame({
          lapCount: 1,
          lapTimeMs: 10,
          lastLapMs: 89000,
          bestLapMs: 89000,
        }),
      ],
      cuts,
      beforeRestart,
    );
    assert.deepEqual(log.laps, [{ lap: 1, timeMs: 89000, status: "valid" }]);
  });

  test("a new session's cuts array is read from its first cut", () => {
    const oldCuts = [cut(0), cut(0)];
    const oldSession = drive(
      [frame({ lapCount: 0, lapTimeMs: 30000 })],
      oldCuts,
    );
    assert.equal(oldSession.consumedCuts, 2);

    const newCuts = [cut(0)];
    const cleared = stepLapLog(oldSession, null, newCuts);
    assert.deepEqual(cleared.laps, []);
    assert.equal(cleared.cutDuring, false);

    const log = drive(
      [frame({ lapCount: 0, lapTimeMs: 5000 })],
      newCuts,
      cleared,
    );
    assert.equal(log.cutDuring, true);
  });
});

describe("Imola demo recording", () => {
  const recording = loadDemoRecording();

  // Every recorded frame (~60 Hz) is stepped, where the hook sees ~30 Hz throttled
  // state; a lap settles within PENDING_MAX_FRAMES new frames either way.
  const replay = (): LapLogState => {
    let log = initialLapLog();
    let cuts: CutEvent[] = [];
    let current: TelemetryFrame | null = null;
    for (const { msg } of recording) {
      if (
        msg.type === "session" ||
        (msg.type === "status" && msg.state === "waiting")
      ) {
        cuts = [];
        current = null;
        log = stepLapLog(log, current, cuts);
      } else if (msg.type === "telemetry") {
        current = msg;
        log = stepLapLog(log, current, cuts);
      } else if (msg.type === "cut") {
        cuts.push(msg);
        log = stepLapLog(log, current, cuts);
      }
    }
    return log;
  };

  test("replays into the five laps the recording completes", () => {
    const log = replay();
    assert.deepEqual(log.laps, [
      // lapCount 0→1, lastLapMs 90526; no frame is in the pit
      { lap: 1, timeMs: 90526, status: "valid" },
      // lapCount 1→2, lastLapMs 86473, adopted as bestLapMs
      { lap: 2, timeMs: 86473, status: "valid" },
      // lapCount 2→3, lastLapMs 87495; all four cut events carry lapCount 2
      { lap: 3, timeMs: 87495, status: "invalid" },
      // lapCount 3→4, lastLapMs 84734, adopted as bestLapMs
      { lap: 4, timeMs: 84734, status: "valid" },
      // lapCount 4→5, lastLapMs 88148, slower than the 84734 best
      { lap: 5, timeMs: 88148, status: "valid" },
    ]);
    assert.deepEqual(log.settled, { lapCount: 5, bestLapMs: 84734 });
    assert.equal(log.cutDuring, false);
  });
});
