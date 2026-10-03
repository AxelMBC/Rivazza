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
  const zoomAround = (zm: Zoom, level: number, ax: number, ay: number) => {
    const r = level / zm.level;
    return { ox: ax - (ax - zm.ox) * r, oy: ay - (ay - zm.oy) * r };
  };

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
    if (st === "following") {
      if (retargetFollow(ZOOM_STEP ** (e.deltaY / 100))) return;
      setFollow("exiting");
      return;
    }
    if (st === "exiting") {
      if (e.deltaY >= 0) return;
      followWindowRef.current = followLimitsRef.current.max;
      setFollow("following");
      return;
    }
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
      zoomRef.current = ZOOM_RESET;
      navRef.current = null;
      if (followRef.current === "detached") setFollow("off");
      return;
    }
    const ax = overInset ? canvas.clientWidth / 2 : e.offsetX;
    const ay = overInset ? canvas.clientHeight / 2 : e.offsetY;
    zoomRef.current = { level, ...zoomAround(zm, level, ax, ay) };
  };
  let tapStart: { x: number; y: number } | null = null;
  let touchMoved = false;
  let lastSingle: { x: number; y: number } | null = null;
  let lastPinch: { dist: number; mx: number; my: number } | null = null;
  let insetTouch = false;

  const touchPoint = (t: Touch) => {
    const rect = canvas.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const detachFollow = () => {
    const st = followRef.current;
    if (st === "following" || st === "exiting") setFollow("detached");
  };
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
      if (followRef.current === "following") {
        if (!retargetFollow(prev.dist / lastPinch.dist)) setFollow("exiting");
        return;
      }
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
        zoomRef.current = ZOOM_RESET;
        if (followRef.current === "detached") setFollow("off");
        return;
      }
      const anchored = zoomAround(zm, level, prev.mx, prev.my);
      zoomRef.current = {
        level,
        ox: anchored.ox + (lastPinch.mx - prev.mx),
        oy: anchored.oy + (lastPinch.my - prev.my),
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
      if (!touchMoved) return;
      navRef.current = null;
      const zm = zoomRef.current;
      if (zm.level <= 1) return;
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
    const gestureWroteZoom = touchMoved && !cameraDrivesView();
    if (insetTouch) {
      if (tapStart) navigateTo(tapStart);
    } else if (tapStart && !touchMoved) {
      mouseRef.current = { x: tapStart.x, y: tapStart.y };
    } else if (gestureWroteZoom) {
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
