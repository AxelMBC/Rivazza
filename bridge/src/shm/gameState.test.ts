import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  initialGameWatch,
  stepGameWatch,
  wireGame,
  type GameWatchStep,
  type RunState,
} from "./gameState";

type Poll = {
  packetId: number | null;
  state?: RunState;
  at: number;
  live?: boolean;
};

const feed = (polls: Poll[], from = initialGameWatch()): GameWatchStep[] => {
  const steps: GameWatchStep[] = [];
  let watch = from;
  for (const { packetId, state = "live", at, live = true } of polls) {
    const sample = packetId === null ? null : { packetId, state };
    const step = stepGameWatch(watch, sample, at, live);
    steps.push(step);
    watch = step.watch;
  }
  return steps;
};

const last = (steps: GameWatchStep[]): GameWatchStep => steps[steps.length - 1];

const driving = (polls: number, from = 0): Poll[] =>
  Array.from({ length: polls }, (_, i) => ({
    packetId: from + i + 1,
    at: (from + i) * 100,
  }));

describe("stepGameWatch", () => {
  test("pausing reports the change and holds the session while the page advances", () => {
    const steps = feed([
      ...driving(3),
      { packetId: 4, state: "paused", at: 300 },
      { packetId: 5, state: "paused", at: 400 },
    ]);
    const pausedAt = steps[3];
    assert.equal(pausedAt.changed, true);
    assert.equal(wireGame(pausedAt.watch.state), "paused");
    assert.equal(pausedAt.holdsSession, true);
    assert.equal(last(steps).changed, false);
    assert.equal(last(steps).holdsSession, true);
  });

  test("resuming reports the change back to live and releases the hold", () => {
    const steps = feed([
      ...driving(2),
      { packetId: 3, state: "paused", at: 200 },
      { packetId: 4, state: "live", at: 300 },
    ]);
    assert.equal(last(steps).changed, true);
    assert.equal(wireGame(last(steps).watch.state), "live");
    assert.equal(last(steps).holdsSession, false);
  });

  test("a replay holds the session like a pause", () => {
    const steps = feed([
      ...driving(2),
      { packetId: 3, state: "replay", at: 200 },
      { packetId: 4, state: "replay", at: 300 },
    ]);
    assert.equal(steps[2].changed, true);
    assert.equal(wireGame(last(steps).watch.state), "replay");
    assert.equal(last(steps).holdsSession, true);
  });

  test("a paused page that stops advancing goes stale after ~2 s and stops holding", () => {
    const steps = feed([
      ...driving(2),
      { packetId: 3, state: "paused", at: 200 },
      { packetId: 3, state: "paused", at: 2200 },
      { packetId: 3, state: "paused", at: 2300 },
    ]);
    assert.equal(steps[3].fresh, true);
    assert.equal(steps[3].holdsSession, true);
    assert.equal(last(steps).fresh, false);
    assert.equal(last(steps).holdsSession, false);
    assert.equal(wireGame(last(steps).watch.state), "paused");
  });

  test("a crash frozen at live neither holds nor ends the session", () => {
    const frozen: Poll[] = Array.from({ length: 60 }, (_, i) => ({
      packetId: 3,
      at: 300 + i * 100,
    }));
    const steps = feed([...driving(3), ...frozen]);
    assert.ok(steps.every((s) => !s.holdsSession && !s.endsSession));
  });

  test("going off after live driving ends the session once", () => {
    const steps = feed([
      ...driving(3),
      { packetId: 4, state: "off", at: 300 },
      { packetId: 5, state: "off", at: 400 },
    ]);
    assert.equal(steps[3].endsSession, true);
    assert.equal(last(steps).endsSession, false);
  });

  test("off while a new session loads over an earlier run's page does not end it", () => {
    const earlierRun = last(feed([...driving(3)])).watch;
    const steps = feed(
      [
        { packetId: 3, at: 10000, live: false },
        { packetId: 3, at: 10100 },
        { packetId: 3, at: 10200 },
        { packetId: 0, state: "off", at: 10300 },
        { packetId: 1, state: "off", at: 10400 },
      ],
      earlierRun,
    );
    assert.ok(steps.every((s) => !s.endsSession));
  });

  test("an advance seen before the session went live does not arm the off rule", () => {
    const steps = feed([
      { packetId: 1, at: 0, live: false },
      { packetId: 2, at: 100, live: false },
      { packetId: 2, at: 200 },
      { packetId: 3, state: "off", at: 300 },
    ]);
    assert.equal(last(steps).endsSession, false);
  });

  test("an unreadable page is unknown: no game, no hold, no end", () => {
    const steps = feed([
      { packetId: null, at: 0 },
      { packetId: null, at: 100 },
    ]);
    assert.ok(
      steps.every(
        (s) =>
          wireGame(s.watch.state) === undefined &&
          !s.changed &&
          !s.holdsSession &&
          !s.endsSession,
      ),
    );
  });
});
