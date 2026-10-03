import { DEAD_ZONE } from "./constants";

export const SURFACE = "#1a1a19";
export const TRACK_FILL = "#242422";
export const TRACK_EDGE = "rgba(255, 255, 255, 0.28)";
export const PREVIOUS_LAP = "rgba(255, 255, 255, 0.45)";
export const HOVERED_GREY_LAP = "#ffffff";
export const INVALID_TIME = "#f0554b"; // --color-critical, brightened for small canvas text
export const TRACK_EDGE_WIDTH = 1.25;
export const SECTOR_EDGE_HOVER = "rgba(255, 255, 255, 0.95)";
export const SECTOR_TICK_LEN = 7;
export const SECTOR_TICK_WIDTH = 1.5;
export const SECTOR_TICK = "rgba(255, 255, 255, 0.5)";
export const SECTOR_LABEL_FONT = "600 10px system-ui";
export const SECTOR_LABEL_FONT_ON = "700 11px system-ui";
export const SECTOR_LABEL_HALO = 3;
export const SECTOR_LABEL_OFFSET = 15; // screen px
export const SECTOR_LABEL_IDLE = "rgba(255, 255, 255, 0.4)";
export const STEER_TICK_COLOR = "#3987e5"; // --color-accent
export const INSET_BORDER = "rgba(255, 255, 255, 0.1)"; // --color-edge
export const INSET_VIEWPORT = "rgba(255, 255, 255, 0.75)";
export const INSET_GHOST = "#3987e5"; // --color-accent
export const INSET_GHOST_FILL = "rgba(57, 135, 229, 0.18)";

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

// 12 steps per ramp is indistinguishable from a continuous lerp at 3 px width,
// and lets the current lap batch into one path stroke per bucket.
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
