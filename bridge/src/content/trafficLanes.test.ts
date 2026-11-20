import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { MapMeta } from "@rivazza/protocol";

import { parseTrafficLanes } from "./trafficLanes.js";

type RawLane = { loop?: unknown; points?: unknown };

const graph = (lanes: unknown[]): string =>
  JSON.stringify({ areas: [], rules: [], intersections: [], lanes });

const lane = (points: unknown, loop = false): RawLane => ({ loop, points });

const straight = lane([
  [10.004, 3, 20.006],
  [30.5, 3.2, 40.25],
]);

const meta: MapMeta = {
  width: 100,
  height: 100,
  xOffset: 0,
  zOffset: 0,
  scaleFactor: 1,
};

describe("parseTrafficLanes", () => {
  test("each lane's [x, y, z] points become [x, z] rounded to centimetres", () => {
    assert.deepEqual(parseTrafficLanes(graph([straight]), null), {
      ok: true,
      lanes: [
        [
          [10, 20.01],
          [30.5, 40.25],
        ],
      ],
    });
  });

  test("a looping lane ends on its first point again", () => {
    const result = parseTrafficLanes(
      graph([
        lane(
          [
            [0, 0, 0],
            [10, 0, 0],
            [10, 0, 10],
          ],
          true,
        ),
      ]),
      null,
    );
    assert.deepEqual(result, {
      ok: true,
      lanes: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 0],
        ],
      ],
    });
  });

  test("a malformed lane is dropped and the others survive", () => {
    const malformed: unknown[] = [
      "not a lane",
      null,
      { loop: false },
      lane("not an array"),
      lane([
        [1, 2, 3],
        [1, "2", 3],
      ]),
      lane([
        [1, 2, 3],
        [1, 2],
      ]),
      lane([[1, 2, 3], "point"]),
      lane([[1, 2, 3]]),
    ];
    assert.deepEqual(
      parseTrafficLanes(graph([...malformed, straight]), null),
      parseTrafficLanes(graph([straight]), null),
    );
  });

  test("a file that isn't a lane graph is invalid", () => {
    for (const text of ["{ lanes: [", "[]", JSON.stringify({ areas: [] })]) {
      assert.deepEqual(parseTrafficLanes(text, null), {
        ok: false,
        reason: "invalid",
      });
    }
  });

  test("a graph whose every lane is dropped is empty", () => {
    assert.deepEqual(parseTrafficLanes(graph([lane([[1, 2, 3]])]), null), {
      ok: false,
      reason: "empty",
    });
    assert.deepEqual(parseTrafficLanes(graph([]), null), {
      ok: false,
      reason: "empty",
    });
  });

  test("a byte-order mark before the JSON is ignored", () => {
    assert.equal(
      parseTrafficLanes(`\uFEFF${graph([straight])}`, null).ok,
      true,
    );
  });

  test("with map bounds, lanes from another track's coordinates are out of bounds", () => {
    const farAway = lane([
      [5000, 0, 5000],
      [5100, 0, 5100],
    ]);
    assert.deepEqual(parseTrafficLanes(graph([farAway]), meta), {
      ok: false,
      reason: "out-of-bounds",
    });
    assert.equal(parseTrafficLanes(graph([straight]), meta).ok, true);
  });

  test("without map bounds no bounds check applies", () => {
    const farAway = lane([
      [5000, 0, 5000],
      [5100, 0, 5100],
    ]);
    assert.equal(parseTrafficLanes(graph([farAway]), null).ok, true);
  });
});
