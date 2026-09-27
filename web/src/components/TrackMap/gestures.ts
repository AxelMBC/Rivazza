import { CLICK_MODE } from "../../lib/interaction";
import { TAP_SLOP_PX } from "../../lib/touch";

import {
  INSET_DWELL_MS,
  INSET_REST_SLOP_PX,
  ZOOM_MAX,
  ZOOM_RESET,
  ZOOM_SNAP_LEVEL,
  ZOOM_STEP,
} from "./constants";
import {
  insetToBase,
  insideRect,
  type Inset,
  type Point,
  type Zoom,
} from "./overviewInset";
import type { FollowState } from "./useFollowControl";

type GestureDeps = {
  insetRef: React.RefObject<Inset | null>;
  mouseRef: React.RefObject<Point | null>;
  zoomRef: React.RefObject<Zoom>;
  navRef: React.RefObject<Point | null>;
  followRef: React.RefObject<FollowState>;
  setFollow: (state: FollowState) => void;
  followWindowRef: React.RefObject<number>;
  followLimitsRef: React.RefObject<{ min: number; max: number }>;
  retargetFollow: (factor: number) => boolean;
  cameraDrivesView: () => boolean;
};

export const attachGestures = (
  canvas: HTMLCanvasElement,
  {
    insetRef,
    mouseRef,
    zoomRef,
    navRef,
    followRef,
    setFollow,
    followWindowRef,
    followLimitsRef,
    retargetFollow,
    cameraDrivesView,
  }: GestureDeps,
) => {
  const navigateTo = (p: Point) => {
    if (insetRef.current && insideRect(insetRef.current, p))
      navRef.current = insetToBase(insetRef.current, p);
  };

  let insetDwellTimer: number | null = null;
  let insetDwellAnchor: Point | null = null;
  const cancelInsetDwell = () => {
    if (insetDwellTimer !== null) clearTimeout(insetDwellTimer);
    insetDwellTimer = null;
    insetDwellAnchor = null;
  };
  // A resting cursor stops dirtying the rAF gate, so the loop cannot notice
  // the rest itself — a timer commits it instead.
  const trackInsetDwell = (p: Point) => {
    if (CLICK_MODE || !insetRef.current || !insideRect(insetRef.current, p)) {
      cancelInsetDwell();
      return;
    }
    const anchor = insetDwellAnchor;
    if (
      anchor &&
      Math.hypot(p.x - anchor.x, p.y - anchor.y) <= INSET_REST_SLOP_PX
    )
      return;
    cancelInsetDwell();
    insetDwellAnchor = p;
    insetDwellTimer = window.setTimeout(() => {
      insetDwellTimer = null;
      if (mouseRef.current) navigateTo(mouseRef.current);
    }, INSET_DWELL_MS);
  };

  const onMouseMove = (e: MouseEvent) => {
    const p = { x: e.offsetX, y: e.offsetY };
    mouseRef.current = p;
    trackInsetDwell(p);
  };
  const onMouseLeave = () => {
    mouseRef.current = null;
    cancelInsetDwell();
  };
  const onClick = (e: MouseEvent) => navigateTo({ x: e.offsetX, y: e.offsetY });
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const st = followRef.current;
    // While tracking, the wheel retargets the camera instead of taking the
    // view off it — scrolling adjusts how tightly the car is framed, and the
    // car stays centred, so the cursor contributes nothing here. The exponent
    // is the free-zoom one with the sign flipped: a *smaller* window is a
    // *higher* zoom, and reusing the same factor makes a notch feel identical
    // in both modes.
    if (st === "following") {
      if (retargetFollow(ZOOM_STEP ** (e.deltaY / 100))) return;
      // Past the widest follow framing: rather than dead-stop, keep the zoom
      // axis continuous and hand the rest of the way out to the exit
      // animation, which lands on exactly the fit view.
      setFollow("exiting");
      return;
    }
    // Mid-exit the wheel would otherwise scroll into an inert handler for the
    // length of the glide. Scrolling back in resumes tracking from where the
    // exit began (the widest framing); scrolling further out is already what
    // the animation is doing.
    if (st === "exiting") {
      if (e.deltaY >= 0) return;
      followWindowRef.current = followLimitsRef.current.max;
      setFollow("following");
      return;
    }
    // Over the inset the cursor's screen point means nothing to the main
    // view, so the zoom anchors at the view centre — which also keeps a
    // glide in progress valid, since it targets a centre.
    const overInset =
      insetRef.current !== null &&
      insideRect(insetRef.current, { x: e.offsetX, y: e.offsetY });
    if (!overInset) navRef.current = null;
    const zm = zoomRef.current;
    const level = Math.min(
      ZOOM_MAX,
      Math.max(1, zm.level * ZOOM_STEP ** (-e.deltaY / 100)),
    );
    if (level === zm.level) return;
    if (level === 1) {
      // Fully out = exact fit framing again; any accumulated focus is
      // discarded and a detached follow is dismissed with it.
      zoomRef.current = ZOOM_RESET;
      navRef.current = null;
      if (followRef.current === "detached") setFollow("off");
      return;
    }
    // Anchor the world point under the cursor: base = (m - o) / level must
    // land back on m, so o' = m - (m - o) * (level' / level).
    const ax = overInset ? canvas.clientWidth / 2 : e.offsetX;
    const ay = overInset ? canvas.clientHeight / 2 : e.offsetY;
    const r = level / zm.level;
    zoomRef.current = {
      level,
      ox: ax - (ax - zm.ox) * r,
      oy: ay - (ay - zm.oy) * r,
    };
  };
  // Touch gestures write the same fresh Zoom objects the wheel writes, so
  // the dirty-gated rAF loop repaints exactly when a gesture changed something.
  let tapStart: { x: number; y: number } | null = null;
  let touchMoved = false; // gesture left the tap slop (pan/pinch happened)
  let lastSingle: { x: number; y: number } | null = null;
  let lastPinch: { dist: number; mx: number; my: number } | null = null;
  // A gesture that starts on the inset belongs to it until every finger
  // lifts: it can only be a tap, never a pan or pinch of the main view.
  let insetTouch = false;

  const touchPoint = (t: Touch) => {
    const rect = canvas.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  // A one-finger pan hands the view to manual zoom/pan in place (zoomRef
  // already holds the follow transform). Follow mode has no pan of its own,
  // so a drag is the user asking to look somewhere else — unlike a pinch,
  // which only ever means "frame the car tighter/wider".
  const detachFollow = () => {
    const st = followRef.current;
    if (st === "following" || st === "exiting") setFollow("detached");
  };
  // Fingers lifted or added mid-gesture: re-seed so deltas never span the
  // finger-count change.
  const seedTouches = (touches: TouchList) => {
    lastSingle = touches.length === 1 ? touchPoint(touches[0]) : null;
    if (touches.length === 2) {
      const a = touchPoint(touches[0]);
      const b = touchPoint(touches[1]);
      lastPinch = {
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
      };
    } else {
      lastPinch = null;
    }
  };

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault(); // no page scroll/zoom, no compatibility mouse events
    if (e.touches.length === 1) {
      tapStart = touchPoint(e.touches[0]);
      touchMoved = false;
      insetTouch =
        insetRef.current !== null && insideRect(insetRef.current, tapStart);
    } else {
      // Multi-finger is never a tap; a lingering readout leaves with it.
      tapStart = null;
      mouseRef.current = null;
    }
    seedTouches(e.touches);
  };

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (insetTouch) {
      const p = e.touches.length === 1 ? touchPoint(e.touches[0]) : null;
      if (
        tapStart &&
        (!p || Math.hypot(p.x - tapStart.x, p.y - tapStart.y) > TAP_SLOP_PX)
      )
        tapStart = null;
      return;
    }
    if (e.touches.length === 2 && lastPinch) {
      const a = touchPoint(e.touches[0]);
      const b = touchPoint(e.touches[1]);
      const prev = lastPinch;
      lastPinch = {
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
      };
      if (prev.dist <= 0 || lastPinch.dist <= 0) return;
      touchMoved = true;
      navRef.current = null;
      // Pinch is the touch twin of the wheel: while tracking it resizes the
      // follow framing and keeps the camera on the car, so midpoint drift has
      // nothing to pan. Past the widest framing it exits, same as the wheel.
      if (followRef.current === "following") {
        if (!retargetFollow(prev.dist / lastPinch.dist)) setFollow("exiting");
        return;
      }
      // Mid-exit, the wheel's interruption rule again: spreading the fingers
      // (zoom in) resumes tracking from where the exit began, pinching further
      // out lets it finish. Handing zoomRef to the gesture here instead would
      // put it and the still-animating camera in a tug of war.
      if (followRef.current === "exiting") {
        if (lastPinch.dist > prev.dist) {
          followWindowRef.current = followLimitsRef.current.max;
          setFollow("following");
        }
        return;
      }
      const zm = zoomRef.current;
      const level = Math.min(
        ZOOM_MAX,
        Math.max(1, zm.level * (lastPinch.dist / prev.dist)),
      );
      if (level === 1) {
        // Fully out = exact fit framing, same rule as the wheel path.
        zoomRef.current = ZOOM_RESET;
        if (followRef.current === "detached") setFollow("off");
        return;
      }
      // Anchor the world point under the pinch midpoint (the wheel formula
      // with the midpoint as the cursor), then pan by the midpoint's motion.
      const r = level / zm.level;
      zoomRef.current = {
        level,
        ox: prev.mx - (prev.mx - zm.ox) * r + (lastPinch.mx - prev.mx),
        oy: prev.my - (prev.my - zm.oy) * r + (lastPinch.my - prev.my),
      };
      return;
    }
    if (e.touches.length === 1 && lastSingle) {
      const p = touchPoint(e.touches[0]);
      const prev = lastSingle;
      lastSingle = p;
      if (
        tapStart &&
        Math.hypot(p.x - tapStart.x, p.y - tapStart.y) > TAP_SLOP_PX
      ) {
        tapStart = null;
        touchMoved = true;
      }
      if (!touchMoved) return; // still within the tap slop — don't jitter
      navRef.current = null;
      const zm = zoomRef.current;
      if (zm.level <= 1) return; // the fit view has nowhere to pan
      detachFollow();
      zoomRef.current = {
        level: zm.level,
        ox: zm.ox + (p.x - prev.x),
        oy: zm.oy + (p.y - prev.y),
      };
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    seedTouches(e.touches);
    if (e.touches.length > 0) return;
    if (insetTouch) {
      if (tapStart) navigateTo(tapStart);
    } else if (tapStart && !touchMoved) {
      // A clean tap: park the "cursor" there — the ordinary hit test shows
      // the readout on a line and clears it on empty track.
      mouseRef.current = { x: tapStart.x, y: tapStart.y };
    } else if (touchMoved && !cameraDrivesView()) {
      // Only meaningful when the gesture was writing zoomRef itself: a
      // retargeting pinch leaves the transform to the camera, which is
      // mid-glide toward a level this snap has no business rounding off.
      const zm = zoomRef.current;
      if (zm.level !== 1 && zm.level < ZOOM_SNAP_LEVEL) {
        zoomRef.current = ZOOM_RESET;
        if (followRef.current === "detached") setFollow("off");
      }
    }
    tapStart = null;
    touchMoved = false;
    insetTouch = false;
  };

  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
  if (CLICK_MODE) canvas.addEventListener("click", onClick);

  return () => {
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mouseleave", onMouseLeave);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove", onTouchMove);
    canvas.removeEventListener("touchend", onTouchEnd);
    canvas.removeEventListener("touchcancel", onTouchEnd);
    canvas.removeEventListener("click", onClick);
    cancelInsetDwell();
  };
};
