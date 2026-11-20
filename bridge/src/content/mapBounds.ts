import type { MapMeta } from "@rivazza/protocol";

const MIN_IN_BOUNDS_RATIO = 0.8;
const BOUNDS_MARGIN = 0.1;

export const roundCm = (v: number): number => Math.round(v * 100) / 100;

// Mod tracks sometimes ship track data copied from another track.
export const insideMapBounds = (
  points: readonly (readonly [number, number])[],
  meta: MapMeta,
): boolean => {
  const spanX = meta.width * meta.scaleFactor;
  const spanZ = meta.height * meta.scaleFactor;
  const minX = -meta.xOffset - spanX * BOUNDS_MARGIN;
  const maxX = -meta.xOffset + spanX * (1 + BOUNDS_MARGIN);
  const minZ = -meta.zOffset - spanZ * BOUNDS_MARGIN;
  const maxZ = -meta.zOffset + spanZ * (1 + BOUNDS_MARGIN);
  let inside = 0;
  for (const [x, z] of points) {
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) inside++;
  }
  return inside / points.length >= MIN_IN_BOUNDS_RATIO;
};
