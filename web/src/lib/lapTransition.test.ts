import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { classifyLapTransition, isLastLapFresh } from "./lapTransition";

describe("classifyLapTransition", () => {
  test("the first frame of a session has no previous lap", () => {
    assert.deepEqual(
      classifyLapTransition(null, 0, { lapCount: 3, lapTimeMs: 500 }),
      { kind: "first" },
    );
  });

  test("a lap counter running backwards is a restart", () => {
    assert.deepEqual(
      classifyLapTransition(4, 30000, { lapCount: 0, lapTimeMs: 30500 }),
      { kind: "restart" },
    );
  });

  test("the lap clock running back by more than a second on the same lap is a restart", () => {
    assert.deepEqual(
      classifyLapTransition(2, 40000, { lapCount: 2, lapTimeMs: 38999 }),
      { kind: "restart" },
    );
  });

  test("a lap clock dip within the one-second slack is not a restart", () => {
    assert.deepEqual(
      classifyLapTransition(2, 40000, { lapCount: 2, lapTimeMs: 39000 }),
      { kind: "same" },
    );
  });

  test("a lap counter going up ticks the lap it completed", () => {
    assert.deepEqual(
      classifyLapTransition(2, 87474, { lapCount: 3, lapTimeMs: 3 }),
      { kind: "tick", completedLap: 3 },
    );
  });

  test("the same lap with the clock moving forward is the same lap", () => {
    assert.deepEqual(
      classifyLapTransition(2, 40000, { lapCount: 2, lapTimeMs: 40016 }),
      { kind: "same" },
    );
  });
});

describe("isLastLapFresh", () => {
  test("a last lap time that changed since the tick is fresh", () => {
    assert.equal(
      isLastLapFresh(
        { lastLapMs: 86473 },
        { lastLapBefore: 90526, framesWaited: 0 },
        3,
      ),
      true,
    );
  });

  test("an unchanged last lap time is not fresh before the frame limit", () => {
    assert.equal(
      isLastLapFresh(
        { lastLapMs: 90526 },
        { lastLapBefore: 90526, framesWaited: 2 },
        3,
      ),
      false,
    );
  });

  test("an unchanged last lap time is taken once the frame limit is reached", () => {
    assert.equal(
      isLastLapFresh(
        { lastLapMs: 90526 },
        { lastLapBefore: 90526, framesWaited: 3 },
        3,
      ),
      true,
    );
  });

  test("no last lap time is never fresh", () => {
    assert.equal(
      isLastLapFresh(
        { lastLapMs: 0 },
        { lastLapBefore: 90526, framesWaited: 10 },
        3,
      ),
      false,
    );
  });
});
