export type Zoom = { level: number; ox: number; oy: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
// `scale` maps base (1× fit) canvas pixels into inset pixels: at 1× the fit
// framing is the whole canvas, so the inset is the canvas scaled down.
export type Inset = Rect & { scale: number };

const INSET_MAX_W = 220;
const INSET_WIDTH_FRACTION = 0.2;
const INSET_RIGHT = 16;
const INSET_TOP = 36; // clears the pedal legend row above it

export const insetRect = (width: number, height: number): Inset => {
  const w = Math.round(Math.min(INSET_MAX_W, width * INSET_WIDTH_FRACTION));
  const h = Math.round((w * height) / width);
  return { x: width - INSET_RIGHT - w, y: INSET_TOP, w, h, scale: w / width };
};

export const insideRect = (r: Rect, p: Point) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export const viewCentre = (zoom: Zoom, width: number, height: number) => ({
  x: (width / 2 - zoom.ox) / zoom.level,
  y: (height / 2 - zoom.oy) / zoom.level,
});

export const centreZoomOn = (
  centre: Point,
  level: number,
  width: number,
  height: number,
): Zoom => ({
  level,
  ox: width / 2 - centre.x * level,
  oy: height / 2 - centre.y * level,
});

export const insetToBase = (inset: Inset, p: Point): Point => ({
  x: (p.x - inset.x) / inset.scale,
  y: (p.y - inset.y) / inset.scale,
});

export const baseToInset = (inset: Inset, p: Point): Point => ({
  x: inset.x + p.x * inset.scale,
  y: inset.y + p.y * inset.scale,
});

export const viewportInInset = (
  inset: Inset,
  zoom: Zoom,
  width: number,
  height: number,
): Rect => {
  const topLeft = baseToInset(inset, {
    x: -zoom.ox / zoom.level,
    y: -zoom.oy / zoom.level,
  });
  return {
    x: topLeft.x,
    y: topLeft.y,
    w: (width / zoom.level) * inset.scale,
    h: (height / zoom.level) * inset.scale,
  };
};
