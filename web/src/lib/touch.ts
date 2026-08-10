// A touch that ends within this much movement (px) is a tap, not a drag.
export const TAP_SLOP_PX = 10;

// After a tap, browsers fire compatibility mouse events (mouseenter, mousemove,
// click) on the touched element; mouse-path handlers that must not react to a
// tap ignore anything inside this window after a handled touch.
export const SYNTHETIC_MOUSE_WINDOW_MS = 500;

// For CSS-defaulting decisions only — event handlers must branch on the
// event's own pointer type, never on a device-wide mode, so a touchscreen
// laptop keeps both interaction models working side by side.
export const hasCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
