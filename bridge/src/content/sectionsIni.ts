import type { TrackSection } from "@rivazza/protocol";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const MIN_SECTIONS = 2;

// Kunos ships sections.ini as UTF-8 with a BOM; mod tracks are often saved in
// the system code page, where an umlaut is a byte that is invalid UTF-8.
const decode = (bytes: Buffer): string => {
  const body = bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)
    ? bytes.subarray(UTF8_BOM.length)
    : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return new TextDecoder("windows-1252").decode(body);
  }
};

const cleanName = (raw: string): string => raw.replace(/\p{Cc}/gu, "").trim();

type Block = { in?: number; out?: number; name?: string };

const readBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  let block: Block | null = null;
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\]]*)\]/);
    if (header) {
      block = /^SECTION_\d+$/i.test(header[1].trim()) ? {} : null;
      if (block) blocks.push(block);
      continue;
    }
    const entry = line.match(/^\s*(IN|OUT|TEXT)\s*=(.*)$/i);
    if (!block || !entry) continue;
    const key = entry[1].toUpperCase();
    if (key === "TEXT") block.name = cleanName(entry[2]);
    else if (key === "IN") block.in = Number.parseFloat(entry[2]);
    else block.out = Number.parseFloat(entry[2]);
  }
  return blocks;
};

const toSection = (block: Block): TrackSection | null => {
  const { in: start, out: end, name } = block;
  if (start === undefined || end === undefined || !name) return null;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start >= end || end > 1) return null;
  return { name, in: start, out: end };
};

export const parseSectionsIni = (bytes: Buffer): TrackSection[] | null => {
  const ordered = readBlocks(decode(bytes))
    .map(toSection)
    .filter((section) => section !== null)
    .sort((a, b) => a.in - b.in);
  const advancing: TrackSection[] = [];
  for (const section of ordered) {
    const previous = advancing[advancing.length - 1];
    if (!previous || section.out > previous.out) advancing.push(section);
  }
  return advancing.length < MIN_SECTIONS ? null : advancing;
};
