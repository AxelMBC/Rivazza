import type { TelemetryFrame } from "@rivazza/protocol";

import {
  ANCHOR_SNAP_M,
  FIRST_LAP_EXTENT,
  FOLLOW_DELAY_MS,
  FOLLOW_MIN_WINDOW_M,
  FOLLOW_TAU_S,
  FOLLOW_WINDOW_HEADROOM,
  VIEW_EASE,
  VIEW_MARGIN,
  ZOOM_MAX,
  ZOOM_RESET,
} from "./constants";
import {
  centreZoomOn,
  viewCentre,
  type Point,
  type Zoom,
} from "./overviewInset";
import type { Project } from "./projection";
import type { View } from "./trackGeometry";
import type { FollowState } from "./useFollowControl";

type CameraDeps = {
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  zoomRef: React.RefObject<Zoom>;
  navRef: React.RefObject<Point | null>;
  followRef: React.RefObject<FollowState>;
  setFollow: (state: FollowState) => void;
  followWindowRef: React.RefObject<number>;
  followLimitsRef: React.RefObject<{ min: number; max: number }>;
  cameraDrivesView: () => boolean;
};

export const createCamera = ({
  telemetryRef,
  zoomRef,
  navRef,
  followRef,
  setFollow,
  followWindowRef,
  followLimitsRef,
  cameraDrivesView,
}: CameraDeps) => {
  // Follow cam keeps repainting while its camera is unsettled ('following'
  // mid-glide or 'exiting'); a settled camera over a stationary car writes
  // no new zoom object and the map idles exactly as before.
  let followAnimating = false;
  let navAnimating = false;
  // Smoothed world position the follow cam tracks (and the dot renders at
  // while following) — absorbs the uneven arrival of raw frames.
  let followPos: { x: number; z: number } | null = null;
  // Where the camera sits relative to the car, in base-projection px. Null
  // until the first tracking frame seeds it from the view being left behind.
  let camOffPx: { x: number; y: number } | null = null;
  // Recent raw frames with arrival times, the interpolation source.
  let trail: { x: number; z: number; at: number }[] = [];
  let lastTrailFrame: TelemetryFrame | null = null;

  // Ease zoomRef toward the follow target (car centered at a comfortable
  // zoom) or back toward the fit view. Runs against the *base* projection
  // of the active mode, before zoomed() reads zoomRef for the frame — the
  // whole follow cam is just this mutation; every mode composes it for free.
  const followCamera = (
    base: Project,
    width: number,
    height: number,
    dt: number,
  ) => {
    followAnimating = false;
    const st = followRef.current;
    if (st !== "following") {
      // Stale buffer times would make a later re-entry interpolate across
      // the idle gap; restart cleanly instead.
      trail.length = 0;
      lastTrailFrame = null;
      followPos = null;
      camOffPx = null;
      if (st !== "exiting") return;
    }
    const zm = zoomRef.current;
    if (st === "following") {
      const frame = telemetryRef.current;
      if (!frame) return;
      // Record raw frame arrivals, then render FOLLOW_DELAY_MS in the past
      // by interpolating between the two buffered frames straddling that
      // instant. A teleport (restart, pit) restarts the buffer — snap.
      if (frame !== lastTrailFrame) {
        lastTrailFrame = frame;
        const newest = trail[trail.length - 1];
        if (
          newest &&
          Math.hypot(frame.x - newest.x, frame.z - newest.z) > ANCHOR_SNAP_M
        ) {
          trail.length = 0;
          camOffPx = { x: 0, y: 0 }; // snap with the car, don't sweep after it
        }
        trail.push({ x: frame.x, z: frame.z, at: performance.now() });
        if (trail.length > 32) trail.shift();
      }
      const wanted = performance.now() - FOLLOW_DELAY_MS;
      let pos: { x: number; z: number } = trail[trail.length - 1];
      if (wanted <= trail[0].at) {
        pos = trail[0];
      } else {
        for (let i = 1; i < trail.length; i++) {
          if (trail[i].at >= wanted) {
            const a = trail[i - 1];
            const b = trail[i];
            const f = b.at === a.at ? 1 : (wanted - a.at) / (b.at - a.at);
            pos = { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
            break;
          }
        }
      }
      // Keep animating while the delayed point is still traversing the
      // buffer, so motion continues between (and after) frame arrivals.
      if (
        !followPos ||
        Math.hypot(pos.x - followPos.x, pos.z - followPos.z) > 0.01
      )
        followAnimating = true;
      followPos = pos;
      const car = base(followPos);
      // Base px-per-meter (uniform, unrotated projections) sizes the
      // comfortable zoom as a fixed world window, not a fixed multiplier.
      const unit = base({ x: followPos.x + 1, z: followPos.z });
      const pxPerMeter = Math.hypot(unit.px - car.px, unit.py - car.py);
      if (pxPerMeter <= 0) return;
      // Bounds for the target window, derived here because only the camera
      // holds the two terms they depend on. They are the exact inverses of
      // the level limits, so the level below needs no clamp of its own:
      // `maxWindow` is the window that would render at 1× — pulled in by
      // FOLLOW_WINDOW_HEADROOM, since a car-centred view at exactly 1×
      // contradicts what 1× means everywhere else (the fit framing).
      const span = Math.min(width, height);
      const maxWindow = (span / pxPerMeter) * FOLLOW_WINDOW_HEADROOM;
      const minWindow = Math.max(
        FOLLOW_MIN_WINDOW_M,
        span / (ZOOM_MAX * pxPerMeter),
      );
      // Publish them for the wheel/pinch handlers, which cannot derive them:
      // a request past `maxWindow` is what they read as "leave follow mode".
      followLimitsRef.current = { min: minWindow, max: maxWindow };
      // Write the clamp back so input beyond a limit cannot accumulate — an
      // unbounded ref would swallow the first several notches back. Settled,
      // this rewrites an identical value and never re-dirties the frame.
      const window_ = Math.min(
        maxWindow,
        Math.max(minWindow, followWindowRef.current),
      );
      followWindowRef.current = window_;
      const targetLevel = span / (window_ * pxPerMeter);
      // Where the camera sits relative to the car, decayed toward zero on its
      // own clock. Easing the camera *toward* the car instead — a target that
      // has moved again by the next frame — settles at an error of roughly
      // speed × FOLLOW_TAU_S rather than at zero: ~18 m at racing speed,
      // which is nothing across the fit view but is the entire canvas at a
      // tight follow window, and the car leaves the screen. Decaying the
      // offset cancels that term, so the car is pinned at the centre at any
      // speed and any zoom, while entry is still one eased glide — it simply
      // starts as one large offset.
      if (!camOffPx)
        camOffPx = {
          x: (width / 2 - zm.ox) / zm.level - car.px,
          y: (height / 2 - zm.oy) / zm.level - car.py,
        };
      const decay = Math.exp(-dt / FOLLOW_TAU_S);
      camOffPx = { x: camOffPx.x * decay, y: camOffPx.y * decay };
      const level = zm.level + (targetLevel - zm.level) * (1 - decay);
      // Asymptotic easing — snap inside a sub-pixel epsilon so it terminates.
      if (
        Math.hypot(camOffPx.x, camOffPx.y) * level < 0.5 &&
        Math.abs(targetLevel - level) < 0.001
      ) {
        camOffPx = { x: 0, y: 0 };
        const pinned = {
          level: targetLevel,
          ox: width / 2 - car.px * targetLevel,
          oy: height / 2 - car.py * targetLevel,
        };
        // A stationary car rewrites identical values, so the map still idles.
        if (
          zm.level !== pinned.level ||
          zm.ox !== pinned.ox ||
          zm.oy !== pinned.oy
        )
          zoomRef.current = pinned;
        return;
      }
      zoomRef.current = {
        level,
        ox: width / 2 - (car.px + camOffPx.x) * level,
        oy: height / 2 - (car.py + camOffPx.y) * level,
      };
      followAnimating = true;
      return;
    }
    // Exiting: the fit view is a static target, so there is no lag term to
    // cancel — ease straight at it.
    const blend = 1 - Math.exp(-dt / FOLLOW_TAU_S);
    const level = zm.level + (ZOOM_RESET.level - zm.level) * blend;
    const ox = zm.ox + (ZOOM_RESET.ox - zm.ox) * blend;
    const oy = zm.oy + (ZOOM_RESET.oy - zm.oy) * blend;
    if (
      Math.abs(ZOOM_RESET.level - level) < 0.001 &&
      Math.abs(ox) < 0.5 &&
      Math.abs(oy) < 0.5
    ) {
      zoomRef.current = ZOOM_RESET; // exact fit framing, as if never followed
      setFollow("off");
      return;
    }
    zoomRef.current = { level, ox, oy };
    followAnimating = true;
  };

  // Inset navigation glides the view centre toward navRef at the unchanged
  // level, with the follow cam's time constant so both glides feel alike.
  const navCamera = (width: number, height: number, dt: number) => {
    navAnimating = false;
    const target = navRef.current;
    if (!target) return;
    const zm = zoomRef.current;
    if (cameraDrivesView() || zm.level <= 1) {
      navRef.current = null;
      return;
    }
    const c = viewCentre(zm, width, height);
    const blend = 1 - Math.exp(-dt / FOLLOW_TAU_S);
    const next = {
      x: c.x + (target.x - c.x) * blend,
      y: c.y + (target.y - c.y) * blend,
    };
    // Asymptotic easing — snap inside a sub-pixel epsilon so it terminates.
    if (Math.hypot(target.x - next.x, target.y - next.y) * zm.level < 0.5) {
      zoomRef.current = centreZoomOn(target, zm.level, width, height);
      navRef.current = null;
      return;
    }
    zoomRef.current = centreZoomOn(next, zm.level, width, height);
    navAnimating = true;
  };

  // While following, the dot renders at the smoothed tracked point so it
  // moves in lockstep with the camera instead of stepping with raw frames.
  const dotWorld = (frame: TelemetryFrame): { x: number; z: number } =>
    followRef.current === "following" && followPos
      ? followPos
      : { x: frame.x, z: frame.z };

  return {
    followCamera,
    navCamera,
    dotWorld,
    followAnimating: () => followAnimating,
    navAnimating: () => navAnimating,
  };
};

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export const fallbackTarget = (
  b: Bounds,
  anchor: { x: number; z: number } | null,
  noLapsYet: boolean,
): View => {
  let target: View;
  if (noLapsYet && anchor) {
    // First lap: camera locked on the starting point at a zoomed-out
    // scale — no panning while the track shape is still unknown. Only
    // zoom out (never in) if the track outgrows the window.
    const pad = 1 + VIEW_MARGIN * 2;
    target = {
      cx: anchor.x,
      cz: anchor.z,
      ex: Math.max(
        FIRST_LAP_EXTENT,
        2 * Math.max(b.maxX - anchor.x, anchor.x - b.minX) * pad,
      ),
      ez: Math.max(
        FIRST_LAP_EXTENT,
        2 * Math.max(b.maxZ - anchor.z, anchor.z - b.minZ) * pad,
      ),
    };
  } else {
    const spanX = Math.max(b.maxX - b.minX, 50);
    const spanZ = Math.max(b.maxZ - b.minZ, 50);
    target = {
      cx: (b.minX + b.maxX) / 2,
      cz: (b.minZ + b.maxZ) / 2,
      ex: spanX * (1 + VIEW_MARGIN * 2),
      ez: spanZ * (1 + VIEW_MARGIN * 2),
    };
  }
  return target;
};

export const easeView = (
  viewRef: React.RefObject<View | null>,
  target: View,
) => {
  let view = viewRef.current;
  if (!view) {
    view = { ...target };
    viewRef.current = view;
  } else {
    view.cx += (target.cx - view.cx) * VIEW_EASE;
    view.cz += (target.cz - view.cz) * VIEW_EASE;
    view.ex += (target.ex - view.ex) * VIEW_EASE;
    view.ez += (target.ez - view.ez) * VIEW_EASE;
    // The easing is asymptotic — snap once within a sub-pixel epsilon so
    // it terminates and the map can go idle between telemetry frames.
    const eps = Math.max(target.ex, target.ez) * 1e-4;
    if (
      Math.abs(target.cx - view.cx) < eps &&
      Math.abs(target.cz - view.cz) < eps &&
      Math.abs(target.ex - view.ex) < eps &&
      Math.abs(target.ez - view.ez) < eps
    ) {
      view.cx = target.cx;
      view.cz = target.cz;
      view.ex = target.ex;
      view.ez = target.ez;
    }
  }
  const easing =
    view.cx !== target.cx ||
    view.cz !== target.cz ||
    view.ex !== target.ex ||
    view.ez !== target.ez;
  return { view, easing };
};
