import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseSectionsIni } from "./sectionsIni.js";

const block = (n: number, start: string, end: string, text?: string): string =>
  [
    `[SECTION_${n}]`,
    `IN=${start}`,
    `OUT=${end}`,
    ...(text === undefined ? [] : [`TEXT=${text}`]),
    "",
  ].join("\r\n");

const utf8 = (text: string): Buffer => Buffer.from(text, "utf8");

describe("parseSectionsIni", () => {
  test("a byte-order mark before the first header does not hide the first section", () => {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      utf8(
        block(0, "0.01", "0.02", "Hatzenbachbogen") +
          block(1, "0.03", "0.05", "Hatzenbach"),
      ),
    ]);
    assert.deepEqual(parseSectionsIni(bytes), [
      { name: "Hatzenbachbogen", in: 0.01, out: 0.02 },
      { name: "Hatzenbach", in: 0.03, out: 0.05 },
    ]);
  });

  test("an accented name reads the same from a UTF-8 and a Windows-1252 file", () => {
    const text =
      block(0, "0.1", "0.2", "Flugplatz") +
      block(1, "0.85", "0.95", "Döttinger Höhe");
    const expected = [
      { name: "Flugplatz", in: 0.1, out: 0.2 },
      { name: "Döttinger Höhe", in: 0.85, out: 0.95 },
    ];
    assert.deepEqual(parseSectionsIni(utf8(text)), expected);
    assert.deepEqual(parseSectionsIni(Buffer.from(text, "latin1")), expected);
  });

  test("a name is trimmed and stripped of control characters", () => {
    const sections = parseSectionsIni(
      utf8(
        block(0, "0.1", "0.2", "Schwalbenschwanz ") +
          block(1, "0.3", "0.4", " Gal\u0007genkopf\t"),
      ),
    );
    assert.deepEqual(
      sections?.map((s) => s.name),
      ["Schwalbenschwanz", "Galgenkopf"],
    );
  });

  test("a malformed block is dropped and the rest still resolve", () => {
    const sections = parseSectionsIni(
      utf8(
        block(0, "0.1", "0.2", "First") +
          block(1, "0.5", "0.4", "Backwards") +
          block(2, "abc", "0.6", "Not a number") +
          block(3, "0.6", "0.7") +
          block(4, "0.7", "1.2", "Past the line") +
          block(5, "0.72", "0.74", "   ") +
          block(6, "0.8", "0.9", "Last"),
      ),
    );
    assert.deepEqual(
      sections?.map((s) => s.name),
      ["First", "Last"],
    );
  });

  test("a section nested inside the previous one is dropped", () => {
    const sections = parseSectionsIni(
      utf8(
        block(0, "0.1", "0.4", "Outer") +
          block(1, "0.2", "0.3", "Nested") +
          block(2, "0.5", "0.6", "Next"),
      ),
    );
    assert.deepEqual(
      sections?.map((s) => s.name),
      ["Outer", "Next"],
    );
  });

  test("blocks are ordered by IN whatever their order and header numbers", () => {
    const sections = parseSectionsIni(
      utf8(
        block(7, "0.5", "0.6", "Third") +
          "[HEADER]\r\nIN=0.9\r\nOUT=0.95\r\nTEXT=Not a section\r\n" +
          block(0, "0.3", "0.4", "Second") +
          "[SECTION_42]\r\nTEXT=First\r\nOUT=0.2\r\nIN=0.1\r\n",
      ),
    );
    assert.deepEqual(
      sections?.map((s) => s.name),
      ["First", "Second", "Third"],
    );
  });

  test("fewer than two surviving sections is no sections", () => {
    assert.equal(parseSectionsIni(utf8(block(0, "0.1", "0.2", "Only"))), null);
    assert.equal(parseSectionsIni(utf8("")), null);
    assert.equal(parseSectionsIni(Buffer.from([0xff, 0xfe, 0x00])), null);
  });
});
