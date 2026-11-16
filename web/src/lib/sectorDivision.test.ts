import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SECTOR_COUNT } from "./lapAnalysis";
import {
  divisionFromSections,
  equalDivision,
  sectorIndexAt,
  sectorLabel,
  sessionDivision,
} from "./sectorDivision";

const sections = [
  { name: "Hatzenbach", in: 0.03, out: 0.09 },
  { name: "Flugplatz", in: 0.11, out: 0.148 },
  { name: "Schwedenkreuz", in: 0.161, out: 0.2 },
];

describe("divisionFromSections", () => {
  const division = divisionFromSections(sections);

  test("a boundary sits midway between one section's end and the next one's start", () => {
    assert.equal(division.bounds.length, 4);
    assert.ok(Math.abs(division.bounds[2] - 0.1545) < 1e-12);
  });

  test("the first sector begins at 0 and the last ends at 1", () => {
    assert.equal(division.bounds[0], 0);
    assert.equal(division.bounds[3], 1);
  });

  test("sectors carry the section names in lap order", () => {
    assert.deepEqual(division.names, [
      "Hatzenbach",
      "Flugplatz",
      "Schwedenkreuz",
    ]);
    assert.equal(sectorLabel(division, 1), "Flugplatz");
  });
});

describe("sessionDivision", () => {
  test("a session without the field or with null sections gets the equal slices", () => {
    for (const division of [sessionDivision(undefined), sessionDivision(null)])
      assert.deepEqual(division, equalDivision(SECTOR_COUNT));
  });

  test("the equal division is unnamed and numbered from S1", () => {
    const division = equalDivision(4);
    assert.deepEqual(division.bounds, [0, 0.25, 0.5, 0.75, 1]);
    assert.equal(division.names, null);
    assert.equal(sectorLabel(division, 2), "S3");
  });

  test("named sections give one sector each", () => {
    assert.deepEqual(sessionDivision(sections).names?.length, 3);
  });
});

describe("sectorIndexAt", () => {
  const division = equalDivision(4);

  test("position 0 is in the first sector", () => {
    assert.equal(sectorIndexAt(division, 0), 0);
  });

  test("a position on a boundary belongs to the sector that starts there", () => {
    assert.equal(sectorIndexAt(division, 0.5), 2);
    assert.equal(sectorIndexAt(division, 0.4999), 1);
  });

  test("position 1 is in the last sector", () => {
    assert.equal(sectorIndexAt(division, 1), 3);
  });

  test("unequal bounds are searched by position, not by index arithmetic", () => {
    const named = divisionFromSections(sections);
    assert.equal(sectorIndexAt(named, 0.09), 0);
    assert.equal(sectorIndexAt(named, 0.12), 1);
    assert.equal(sectorIndexAt(named, 0.9), 2);
  });
});
