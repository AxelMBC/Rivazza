import { SECTOR_COUNT, type SectorOwner } from "../../lib/lapAnalysis";

export const PAD_X = 10;
export const PAD_TOP = 16; // room for the caption row above the first strip
export const PAD_BOTTOM = 8;
export const STRIP_GAP = 18; // captions live in the gaps between strips
// Fixed, not a share of the panel height: the ribbon carries meaning in colour
// alone, and a proportional height turns it into a hairline on short viewports.
export const RIBBON_H = 12;
// Slices are wide at this count, so a hairline gap reads as a seam rather than
// a boundary; 2 px keeps the divisions as legible as 1 px was when they were a
// third of the width.
export const SLICE_GAP = 2;
// Same canvas color literals as the map/pedal-trace convention.
export const REFERENCE_TRACE = "rgba(255, 255, 255, 0.4)";
export const THROTTLE_TRACE = "rgb(18, 190, 60)";
export const BRAKE_TRACE = "rgb(235, 55, 45)";
export const COAST_TEXT = "#fab219";
export const GRID = "rgba(255, 255, 255, 0.07)";
export const CAPTION = "rgba(255, 255, 255, 0.35)";
export const SLICE_UNOWNED = "#2c2c2a"; // --color-hairline
export const SLICE_INVALID = "#d03b3b"; // --color-critical
export const INVALID_SLICE_BAR = 3; // of RIBBON_H, so it reads as a mark on the slice
// Dim enough that an invalid slice never competes with the laps that count,
// opaque enough that its lap hue stays nameable against the panel ground.
export const INVALID_SLICE_ALPHA = 0.45;
export const SCRUB_BAND = "rgba(255, 255, 255, 0.07)";
// Delta strip never zooms tighter than ±0.5 s, so tiny wobbles read as flat.
export const MIN_DELTA_RANGE_MS = 500;

export type Strip = { top: number; h: number };

export const layoutStrips = (
  height: number,
): { speed: Strip; pedals: Strip; delta: Strip; sectors: Strip } => {
  const avail = height - PAD_TOP - PAD_BOTTOM - STRIP_GAP * 3 - RIBBON_H;
  const speed = { top: PAD_TOP, h: avail * 0.42 };
  const pedals = { top: speed.top + speed.h + STRIP_GAP, h: avail * 0.24 };
  const delta = { top: pedals.top + pedals.h + STRIP_GAP, h: avail * 0.34 };
  const sectors = { top: delta.top + delta.h + STRIP_GAP, h: RIBBON_H };
  return { speed, pedals, delta, sectors };
};

export const sliceAt = (pos: number) =>
  Math.min(SECTOR_COUNT - 1, Math.floor(pos * SECTOR_COUNT));

// The recordings version does not cover the ribbon: a lap's invalid flag can
// land in the lap log frames after its recording is stored, flipping a slice's
// colour with no version bump. Fingerprinting the owners keeps the cached trace
// layer correct without rebuilding it on every scrub frame.
export const ownersKey = (owners: readonly (SectorOwner | null)[]) =>
  owners
    .map((o) => (o === null ? "-" : `${o.lap}${o.invalid ? "!" : ""}`))
    .join();

export const plotX = (pos: number, width: number) =>
  PAD_X + pos * (width - PAD_X * 2);
