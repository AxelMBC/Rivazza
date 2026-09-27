import type { MapMeta } from "@rivazza/protocol";

import { PADDING } from "./constants";
import type { Sample } from "./lineRecorder";
import type { Zoom } from "./overviewInset";
import type { View } from "./trackGeometry";

export type Projected = { px: number; py: number };
export type Project = (p: { x: number; z: number }) => Projected;

// Screen-space zoom over a base fit projection. Points (not the canvas
// transform) are scaled, so stroke widths, the dot radius, and the hover
// pick radius stay constant in screen pixels at every zoom level.
export const zoomed =
  (base: Project, zoomRef: React.RefObject<Zoom>): Project =>
  (p) => {
    const { px, py } = base(p);
    const zm = zoomRef.current;
    return { px: px * zm.level + zm.ox, py: py * zm.level + zm.oy };
  };

// Every projection here is a uniform-scale, axis-aligned affine map
// (px = k·x + tx, py = k·z + ty), so world-space Path2D geometry renders
// in one native stroke under the canvas transform instead of a JS loop
// per point — the flat per-frame cost that keeps a moving camera at
// 60 fps. The coefficients are read off the live projection numerically
// so this works identically in all three modes at any zoom state.
export type Affine = { k: number; tx: number; ty: number };
export const affineOf = (project: Project): Affine => {
  const o = project({ x: 0, z: 0 });
  const u = project({ x: 1, z: 0 });
  return { k: u.px - o.px, tx: o.px, ty: o.py };
};

// Stroke widths divide by the scale so they stay constant in screen
// pixels at every zoom level — same guarantee as point-space rendering.
export const strokeWorldPath = (
  target: CanvasRenderingContext2D,
  path: Path2D,
  { k, tx, ty }: Affine,
  dpr: number,
  color: string,
  widthPx: number,
) => {
  target.save();
  target.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);
  target.strokeStyle = color;
  target.lineWidth = widthPx / k;
  target.lineCap = "round";
  target.lineJoin = "round";
  target.stroke(path);
  target.restore();
};

// World-space lap line, jumps as subpath breaks. Built once per lap and
// reused at every zoom and camera state.
export const buildLapPath = (samples: Sample[]): Path2D => {
  const path = new Path2D();
  samples.forEach((s, i) => {
    if (i === 0 || s.jump) path.moveTo(s.x, s.z);
    else path.lineTo(s.x, s.z);
  });
  return path;
};

// map.ini pixel dimensions fix the viewport, so the framing is identical from
// the very first frame. World (x, z) -> map.ini pixel space -> normalized ->
// canvas.
export const metaProjection = (
  meta: MapMeta,
  width: number,
  height: number,
): Project => {
  const scale = Math.min(
    (width - PADDING * 2) / meta.width,
    (height - PADDING * 2) / meta.height,
  );
  const drawnW = meta.width * scale;
  const drawnH = meta.height * scale;
  const offsetX = (width - drawnW) / 2;
  const offsetY = (height - drawnH) / 2;
  return (p) => ({
    px:
      offsetX + ((p.x + meta.xOffset) / meta.scaleFactor / meta.width) * drawnW,
    py:
      offsetY +
      ((p.z + meta.zOffset) / meta.scaleFactor / meta.height) * drawnH,
  });
};

// A world-space view fitted to the canvas: the edge ribbon's fixed bounds, or
// the driven lines' eased bounds when the track has no map data. World +Z maps
// down-screen — the same handedness as the map.ini projection, so turn
// direction is never mirrored between modes.
export const viewProjection = (
  view: View,
  width: number,
  height: number,
): Project => {
  const scale = Math.min(
    (width - PADDING * 2) / view.ex,
    (height - PADDING * 2) / view.ez,
  );
  return (p) => ({
    px: width / 2 + (p.x - view.cx) * scale,
    py: height / 2 + (p.z - view.cz) * scale,
  });
};
