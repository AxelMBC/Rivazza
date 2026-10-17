import type { MapMeta } from "@rivazza/protocol";

import { PADDING } from "./constants";
import type { Sample } from "./lineRecorder";
import type { Zoom } from "./overviewInset";
import type { View } from "./trackGeometry";

export type Projected = { px: number; py: number };
export type Project = (p: { x: number; z: number }) => Projected;

export const zoomed =
  (base: Project, zoomRef: React.RefObject<Zoom>): Project =>
  (p) => {
    const { px, py } = base(p);
    const zm = zoomRef.current;
    return { px: px * zm.level + zm.ox, py: py * zm.level + zm.oy };
  };

export type Affine = { kx: number; ky: number; tx: number; ty: number };
export const affineOf = (project: Project): Affine => {
  const o = project({ x: 0, z: 0 });
  const u = project({ x: 1, z: 0 });
  const v = project({ x: 0, z: 1 });
  return { kx: u.px - o.px, ky: v.py - o.py, tx: o.px, ty: o.py };
};

export const scaleAffine = (
  { kx, ky, tx, ty }: Affine,
  factor: number,
): Affine => ({
  kx: kx * factor,
  ky: ky * factor,
  tx: tx * factor,
  ty: ty * factor,
});

export const setWorldTransform = (
  target: CanvasRenderingContext2D,
  { kx, ky, tx, ty }: Affine,
  dpr: number,
) => target.setTransform(dpr * kx, 0, 0, dpr * ky, dpr * tx, dpr * ty);

export const strokeWorldPath = (
  target: CanvasRenderingContext2D,
  path: Path2D,
  aff: Affine,
  dpr: number,
  color: string,
  widthPx: number,
) => {
  target.save();
  setWorldTransform(target, aff, dpr);
  target.strokeStyle = color;
  target.lineWidth = widthPx / Math.abs(aff.kx);
  target.lineCap = "round";
  target.lineJoin = "round";
  target.stroke(path);
  target.restore();
};

export const buildLapPath = (samples: Sample[]): Path2D => {
  const path = new Path2D();
  samples.forEach((s, i) => {
    if (i === 0 || s.jump) path.moveTo(s.x, s.z);
    else path.lineTo(s.x, s.z);
  });
  return path;
};

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
