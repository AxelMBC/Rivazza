import { DEAD_ZONE } from "./constants";

export const SURFACE = "#1a1a19";
// Track-limits ribbon: asphalt just above the panel surface, edge strokes
// muted so the pedal-colored lines stay visually dominant.
export const TRACK_FILL = "#242422";
export const TRACK_EDGE = "rgba(255, 255, 255, 0.28)";
export const PREVIOUS_LAP = "rgba(255, 255, 255, 0.45)";
export const HOVERED_GREY_LAP = "#ffffff"; // uncolored laps brighten to solid white on hover
export const INVALID_TIME = "#f0554b"; // theme critical, brightened for the small canvas label
// The track edge stays neutral and thin. Lap-identity hues here read as a
// second set of driving lines and swamp the real ones — the division is
// carried by the boundary ticks and the labels instead, so the only saturated
// colour on the map is a lap's own line.
export const TRACK_EDGE_WIDTH = 1.25;
// Hover brightens the edge, it does not thicken it: a width change shifts the
// track's apparent limits, which is the one thing the edge must not do.
export const SECTOR_EDGE_HOVER = "rgba(255, 255, 255, 0.95)";
// Boundary ticks point outward from the edge only. Nothing is ever drawn
// across the asphalt.
export const SECTOR_TICK_LEN = 7;
export const SECTOR_TICK_WIDTH = 1.5;
export const SECTOR_TICK = "rgba(255, 255, 255, 0.5)";
export const SECTOR_LABEL_FONT = "600 10px system-ui";
export const SECTOR_LABEL_FONT_ON = "700 11px system-ui";
export const SECTOR_LABEL_HALO = 3;
export const SECTOR_LABEL_OFFSET = 15; // screen px clear of the edge
export const SECTOR_LABEL_IDLE = "rgba(255, 255, 255, 0.4)";
export const STEER_TICK_COLOR = "#3987e5"; // theme accent, mirrors --color-accent
export const INSET_BORDER = "rgba(255, 255, 255, 0.1)"; // mirrors --color-edge
export const INSET_VIEWPORT = "rgba(255, 255, 255, 0.75)";
export const INSET_GHOST = "#3987e5"; // theme accent, mirrors --color-accent
export const INSET_GHOST_FILL = "rgba(57, 135, 229, 0.18)";

// Pedal-state colors: coast (yellow) blends toward throttle (green) or
// brake (red) with pedal magnitude, so partial inputs read as softer tones.
type Rgb = [number, number, number];
export const COAST: Rgb = [250, 178, 25];
export const THROTTLE: Rgb = [18, 190, 60];
export const BRAKE: Rgb = [235, 55, 45];

export const rgb = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

const lerpColor = (from: Rgb, to: Rgb, t: number) =>
  rgb(
    from.map((f, i) =>
      Math.round(f + (to[i] - f) * Math.min(1, Math.max(0, t))),
    ) as Rgb,
  );

// Pedal colors quantized into a small set of buckets so the current lap's
// line batches into one native path stroke per bucket instead of a canvas
// stroke per segment — the difference between a flat and a linearly growing
// per-frame cost while the camera moves. 12 steps per ramp is visually
// indistinguishable from the continuous lerp at 3 px line width.
// Key: 0 = coast, positive = throttle bucket, negative = brake bucket.
const COLOR_QUANT = 12;
export const bucketKey = (gas: number, brake: number): number => {
  if (brake > DEAD_ZONE && brake >= gas)
    return -Math.max(1, Math.round(brake * COLOR_QUANT));
  if (gas > DEAD_ZONE) return Math.max(1, Math.round(gas * COLOR_QUANT));
  return 0;
};
export const bucketColor = (key: number): string => {
  if (key < 0) return lerpColor(COAST, BRAKE, -key / COLOR_QUANT);
  if (key > 0) return lerpColor(COAST, THROTTLE, key / COLOR_QUANT);
  return rgb(COAST);
};
