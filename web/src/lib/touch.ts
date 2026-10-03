export const TAP_SLOP_PX = 10;

// Browsers fire compatibility mouse events (mouseenter, mousemove, click) on the
// tapped element shortly after a tap.
export const SYNTHETIC_MOUSE_WINDOW_MS = 500;

export const hasCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
