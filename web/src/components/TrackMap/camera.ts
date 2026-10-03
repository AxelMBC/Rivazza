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
  let followAnimating = false;
  let navAnimating = false;
  let followPos: { x: number; z: number } | null = null;
  let camOffPx: { x: number; y: number } | null = null;
  let trail: { x: number; z: number; at: number }[] = [];
  let lastTrailFrame: TelemetryFrame | null = null;

  const resetTracking = () => {
    trail.length = 0;
    lastTrailFrame = null;
    followPos = null;
    camOffPx = null;
  };

  const followCamera = (
    base: Project,
    width: number,
    height: number,
    dt: number,
  ) => {
    followAnimating = false;
    const st = followRef.current;
    if (st !== "following") {
      resetTracking();
      if (st !== "exiting") return;
    }
    const zm = zoomRef.current;
    if (st === "following") {
      const frame = telemetryRef.current;
      if (!frame) return;
      if (frame !== lastTrailFrame) {
        lastTrailFrame = frame;
        const newest = trail[trail.length - 1];
        if (
          newest &&
          Math.hypot(frame.x - newest.x, frame.z - newest.z) > ANCHOR_SNAP_M
        ) {
          trail.length = 0;
          camOffPx = { x: 0, y: 0 };
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
      if (
        !followPos ||
        Math.hypot(pos.x - followPos.x, pos.z - followPos.z) > 0.01
      )
        followAnimating = true;
      followPos = pos;
      const car = base(followPos);
      const unit = base({ x: followPos.x + 1, z: followPos.z });
      const pxPerMeter = Math.hypot(unit.px - car.px, unit.py - car.py);
      if (pxPerMeter <= 0) return;
      const span = Math.min(width, height);
      const maxWindow = (span / pxPerMeter) * FOLLOW_WINDOW_HEADROOM;
      const minWindow = Math.max(
        FOLLOW_MIN_WINDOW_M,
        span / (ZOOM_MAX * pxPerMeter),
      );
      followLimitsRef.current = { min: minWindow, max: maxWindow };
      const window_ = Math.min(
        maxWindow,
        Math.max(minWindow, followWindowRef.current),
      );
      followWindowRef.current = window_;
      const targetLevel = span / (window_ * pxPerMeter);
      if (!camOffPx)
        camOffPx = {
          x: (width / 2 - zm.ox) / zm.level - car.px,
          y: (height / 2 - zm.oy) / zm.level - car.py,
        };
      const decay = Math.exp(-dt / FOLLOW_TAU_S);
      camOffPx = { x: camOffPx.x * decay, y: camOffPx.y * decay };
      const level = zm.level + (targetLevel - zm.level) * (1 - decay);
      const settled =
        Math.hypot(camOffPx.x, camOffPx.y) * level < 0.5 &&
        Math.abs(targetLevel - level) < 0.001;
      if (settled) {
        camOffPx = { x: 0, y: 0 };
        const pinned = {
          level: targetLevel,
          ox: width / 2 - car.px * targetLevel,
          oy: height / 2 - car.py * targetLevel,
        };
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
    const blend = 1 - Math.exp(-dt / FOLLOW_TAU_S);
    const level = zm.level + (ZOOM_RESET.level - zm.level) * blend;
    const ox = zm.ox + (ZOOM_RESET.ox - zm.ox) * blend;
    const oy = zm.oy + (ZOOM_RESET.oy - zm.oy) * blend;
    if (
      Math.abs(ZOOM_RESET.level - level) < 0.001 &&
      Math.abs(ox) < 0.5 &&
      Math.abs(oy) < 0.5
    ) {
      zoomRef.current = ZOOM_RESET;
      setFollow("off");
      return;
    }
    zoomRef.current = { level, ox, oy };
    followAnimating = true;
  };

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
    if (Math.hypot(target.x - next.x, target.y - next.y) * zm.level < 0.5) {
      zoomRef.current = centreZoomOn(target, zm.level, width, height);
      navRef.current = null;
      return;
    }
    zoomRef.current = centreZoomOn(next, zm.level, width, height);
    navAnimating = true;
  };

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
