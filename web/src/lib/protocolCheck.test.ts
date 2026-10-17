import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PROTOCOL_VERSION } from "@rivazza/protocol";

import { loadDemoRecording } from "./demoRecording.testkit";
import { matchesProtocol } from "./protocolCheck";

describe("matchesProtocol", () => {
  test("a status carrying the current version matches", () => {
    assert.equal(matchesProtocol({ protocol: PROTOCOL_VERSION }), true);
  });

  test("a status carrying another version does not match", () => {
    assert.equal(matchesProtocol({ protocol: PROTOCOL_VERSION + 1 }), false);
  });

  test("a status without the field does not match", () => {
    assert.equal(matchesProtocol({}), false);
  });
});

describe("the committed demo recording", () => {
  const recording = loadDemoRecording();

  test("every status message carries the current protocol version", () => {
    const statuses = recording.flatMap(({ msg }) =>
      msg.type === "status" ? [msg] : [],
    );
    assert.ok(statuses.length > 0, "the recording has no status message");
    for (const status of statuses) {
      assert.equal(
        status.protocol,
        PROTOCOL_VERSION,
        `the demo recording carries protocol ${String(status.protocol)}, expected ${PROTOCOL_VERSION}: re-record or migrate web/public/demo/imola.json`,
      );
    }
  });
});
