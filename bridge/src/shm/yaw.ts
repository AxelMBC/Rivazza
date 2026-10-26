import type { LazyPage } from "./lazyPage.js";

// SPageFilePhysics `heading`: every member before it is a 4-byte scalar or
// float array under #pragma pack(4), like the offsets cutDetection.ts reads.
const OFF_HEADING = 208;
const READ_SIZE = OFF_HEADING + 4;

export const createYawReader = (
  physics: LazyPage,
): (() => number | undefined) => {
  const page = Buffer.alloc(READ_SIZE);
  return () => {
    if (!physics.read(page)) return undefined;
    const yaw = page.readFloatLE(OFF_HEADING);
    return Number.isFinite(yaw) ? yaw : undefined;
  };
};
