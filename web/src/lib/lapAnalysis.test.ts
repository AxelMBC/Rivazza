import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { LapRecord } from "../hooks/useLapHistory";
import type {
  LapRecording,
  LapTelemetrySample,
} from "../hooks/useLapRecordings";

import {
  bestSectors,
  coversLap,
  interpolateTimeAt,
  sectorOwners,
  sectorTimes,
  theoreticalBestMs,
} from "./lapAnalysis";

const sample = (pos: number, timeMs: number): LapTelemetrySample => ({
  pos,
  timeMs,
  speedKmh: 0,
  gas: 0,
  brake: 0,
  gear: 0,
  steerAngle: 0,
  x: 0,
  z: 0,
});

const recordingOf = (
  lap: number,
  sectorMs: readonly number[],
): LapRecording => {
  const samples = [sample(0, 0)];
  let timeMs = 0;
  sectorMs.forEach((ms, i) => {
    timeMs += ms;
    samples.push(sample((i + 1) / sectorMs.length, timeMs));
  });
  return { lap, timeMs, complete: true, samples };
};

describe("coversLap", () => {
  test("a lap sampled from near the line to near the line is covered", () => {
    assert.equal(coversLap([{ pos: 0.03 }, { pos: 0.5 }, { pos: 0.97 }]), true);
  });

  test("a lap whose samples start after 5% is not covered", () => {
    assert.equal(coversLap([{ pos: 0.1 }, { pos: 0.97 }]), false);
  });

  test("a lap whose samples end before 95% is not covered", () => {
    assert.equal(coversLap([{ pos: 0.03 }, { pos: 0.9 }]), false);
  });

  test("a single sample covers nothing", () => {
    assert.equal(coversLap([{ pos: 0 }]), false);
  });
});

describe("interpolateTimeAt", () => {
  const samples = [
    { pos: 0.2, timeMs: 10000 },
    { pos: 0.4, timeMs: 30000 },
  ];

  test("a position between two samples is timed linearly", () => {
    assert.equal(interpolateTimeAt(samples, 0.3), 20000);
  });

  test("a position on a sample takes its time", () => {
    assert.equal(interpolateTimeAt(samples, 0.4), 30000);
  });

  test("a position outside the samples has no time", () => {
    assert.equal(interpolateTimeAt(samples, 0.1), null);
    assert.equal(interpolateTimeAt(samples, 0.5), null);
  });
});

describe("sectorTimes", () => {
  test("a fully sampled lap splits into its equal-length slices", () => {
    assert.deepEqual(
      sectorTimes(recordingOf(1, [20000, 22000, 18000, 21000]), 4),
      [20000, 22000, 18000, 21000],
    );
  });

  test("a lap sampled from just after the line to just before it is closed by 0 and the lap time", () => {
    const rec: LapRecording = {
      lap: 1,
      timeMs: 80500,
      complete: true,
      samples: [sample(0.02, 1000), sample(0.5, 40000), sample(0.98, 79000)],
    };
    assert.deepEqual(sectorTimes(rec, 2), [40000, 40500]);
  });

  test("slices before a partial lap's first sample have no time", () => {
    const rec: LapRecording = {
      lap: 1,
      timeMs: null,
      complete: false,
      samples: [
        sample(0.3, 0),
        sample(0.5, 20000),
        sample(0.75, 45000),
        sample(1, 70000),
      ],
    };
    assert.deepEqual(sectorTimes(rec, 4), [null, null, 25000, 25000]);
  });
});

describe("best sectors", () => {
  const recordings = [
    recordingOf(1, [20000, 22000, 18000, 21000]),
    recordingOf(2, [15000, 25000, 25000, 25000]),
    recordingOf(3, [19000, 23000, 18500, 20000]),
    recordingOf(4, [10000, 10000, 10000, 10000]),
  ];
  const laps: LapRecord[] = [
    { lap: 1, timeMs: 81000, status: "valid" },
    { lap: 2, timeMs: 90000, status: "invalid" },
    { lap: 3, timeMs: 80500, status: "valid" },
    { lap: 4, timeMs: 40000, status: "in" },
  ];

  test("the best of each sector is taken from valid laps only", () => {
    assert.deepEqual(
      bestSectors(recordings, laps, 4),
      [19000, 22000, 18000, 20000],
    );
  });

  test("a sector's owner can be an invalid lap, flagged as such, but never a pit lap", () => {
    assert.deepEqual(sectorOwners(recordings, laps, 4), [
      { lap: 2, timeMs: 15000, invalid: true },
      { lap: 1, timeMs: 22000, invalid: false },
      { lap: 1, timeMs: 18000, invalid: false },
      { lap: 3, timeMs: 20000, invalid: false },
    ]);
  });

  test("a recording with no lap in the log owns no sector", () => {
    assert.deepEqual(sectorOwners([recordingOf(9, [1000, 1000])], laps, 2), [
      null,
      null,
    ]);
  });

  test("the theoretical best is the sum of the best sectors", () => {
    assert.equal(theoreticalBestMs([19000, 22000, 18000, 20000]), 79000);
  });

  test("a sector with no best leaves no theoretical best", () => {
    assert.equal(theoreticalBestMs([19000, null, 18000, 20000]), null);
  });
});
