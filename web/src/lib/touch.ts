// Touch-interaction helpers. The desktop model is deliberately hover/wheel
// only (a click would focus the browser and steal controller input from the
// game), but that rationale is desktop-specific — on a phone or tablet the
// game isn't running on the device, so touch gets first-class tap/gesture
// equivalents. Handlers branch on each gesture's own modality (touch events,
// or pointer events with pointerType 'touch'), never on a device-wide mode,
// so a touchscreen laptop keeps both models working side by side.

// A touch that ends within this much movement (px) is a tap, not a drag.
export const TAP_SLOP_PX = 10;

// After a tap, browsers fire compatibility mouse events (mouseenter, mousemove,
// click) on the touched element; mouse-path handlers that must not react to a
// tap ignore anything inside this window after a handled touch.
export const SYNTHETIC_MOUSE_WINDOW_MS = 500;

// Whether the primary pointer is coarse (touch). For CSS-defaulting decisions
// only — event handlers must branch on the event's own pointer type instead.
export const hasCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
