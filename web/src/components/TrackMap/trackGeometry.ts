import { SECTOR_COUNT } from "../../lib/lapAnalysis";

import { VIEW_MARGIN } from "./constants";
import type { MapData } from "./useTrackMapData";

// A world point plus a unit direction pointing off the track. Projecting the
// direction turns it into a screen offset that holds at any zoom.
export type Anchor = { x: number; z: number; dx: number; dz: number };
export type View = { cx: number; cz: number; ex: number; ez: number };

// Index runs of the edge polylines, one per sector, from the normalized
// positions the bridge ships with the edges. Adjacent runs share their
// boundary vertex so the strokes meet with no seam; on a closed circuit the
// last run wraps back to vertex 0. Positions are monotonic, so one pass finds
// every run's start.
const sectorVertexRuns = (
  pos: readonly number[],
  count: number,
  closed: boolean,
): number[][] => {
  const starts = new Array<number>(count).fill(-1);
  for (let i = 0; i < pos.length; i++) {
    const s = Math.min(count - 1, Math.max(0, Math.floor(pos[i] * count)));
    if (starts[s] < 0) starts[s] = i;
  }
  return starts.map((from, s) => {
    if (from < 0) return [];
    let next = -1;
    for (let t = s + 1; t < count && next < 0; t++) next = starts[t];
    const end = next >= 0 ? next : pos.length - 1;
    const run: number[] = [];
    for (let i = from; i <= end; i++) run.push(i);
    if (next < 0 && closed) run.push(0);
    return run;
  });
};

export const buildTrackGeometry = (mapData: MapData | null) => {
  const edges = mapData?.edges ?? null;
  // Track edges without map.ini: the ribbon's world bounds (plus margin)
  // fix the viewport — the same never-moving guarantee as the metadata fit.
  let edgeView: View | null = null;
  // The centre is also what decides which way a sector label faces, so the
  // bounds are taken whenever edges exist, not only in the no-metadata case.
  let edgeCentre: { x: number; z: number } | null = null;
  if (edges) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const line of [edges.left, edges.right]) {
      for (const [x, z] of line) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
    }
    edgeCentre = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    if (!mapData?.meta)
      edgeView = {
        cx: edgeCentre.x,
        cz: edgeCentre.z,
        ex: Math.max(maxX - minX, 50) * (1 + VIEW_MARGIN * 2),
        ez: Math.max(maxZ - minZ, 50) * (1 + VIEW_MARGIN * 2),
      };
  }

  // Static world-space ribbon geometry, built once per map.
  const traceInto = (
    path: Path2D,
    line: [number, number][],
    reverse: boolean,
    move: boolean,
  ) => {
    for (let i = 0; i < line.length; i++) {
      const [x, z] = line[reverse ? line.length - 1 - i : i];
      if (i === 0 && move) path.moveTo(x, z);
      else path.lineTo(x, z);
    }
  };
  let edgesFill: Path2D | null = null;
  let sectorEdges: { left: Path2D; right: Path2D }[] = [];
  let sectorLabels: (Anchor | null)[] = [];
  let sectorTicks: (Anchor | null)[][] = [];
  if (edges) {
    // Closed circuits fill as an annulus: the two edge rings run in
    // opposite directions, so the nonzero rule leaves the infield empty.
    // Open splines (hillclimbs) fill as a single strip.
    edgesFill = new Path2D();
    if (edges.closed) {
      traceInto(edgesFill, edges.left, false, true);
      edgesFill.closePath();
      traceInto(edgesFill, edges.right, true, true);
      edgesFill.closePath();
    } else {
      traceInto(edgesFill, edges.left, false, true);
      traceInto(edgesFill, edges.right, true, false);
      edgesFill.closePath();
    }
    const runs = sectorVertexRuns(edges.pos, SECTOR_COUNT, edges.closed);
    const traceRun = (line: [number, number][], run: number[]) => {
      const p = new Path2D();
      run.forEach((i, k) => {
        const [x, z] = line[i];
        if (k === 0) p.moveTo(x, z);
        else p.lineTo(x, z);
      });
      return p;
    };
    sectorEdges = runs.map((run) => ({
      left: traceRun(edges.left, run),
      right: traceRun(edges.right, run),
    }));

    // Anchors carry a world-unit direction pointing off the track, which
    // projecting turns into a fixed screen offset at any zoom. Both edges at
    // a sector's first vertex give the boundary ticks; the mid vertex of
    // whichever edge faces away from the track's centre gives the label, so
    // all eight land outside the circuit rather than some in the infield.
    const centre = edgeCentre;
    const anchorAt = (i: number, side: "left" | "right"): Anchor | null => {
      const [lx, lz] = edges.left[i];
      const [rx, rz] = edges.right[i];
      const span = Math.hypot(rx - lx, rz - lz);
      if (span === 0) return null;
      const ux = (rx - lx) / span;
      const uz = (rz - lz) / span;
      return side === "left"
        ? { x: lx, z: lz, dx: -ux, dz: -uz }
        : { x: rx, z: rz, dx: ux, dz: uz };
    };
    const outwardness = (a: Anchor | null) =>
      a && centre
        ? (a.x - centre.x) * a.dx + (a.z - centre.z) * a.dz
        : -Infinity;

    sectorTicks = runs.map((run) =>
      run.length === 0
        ? []
        : [anchorAt(run[0], "left"), anchorAt(run[0], "right")],
    );
    sectorLabels = runs.map((run) => {
      if (run.length === 0 || !centre) return null;
      const i = run[run.length >> 1];
      const left = anchorAt(i, "left");
      const right = anchorAt(i, "right");
      return outwardness(left) > outwardness(right) ? left : right;
    });
  }
  return {
    edges,
    edgeView,
    edgesFill,
    sectorEdges,
    sectorLabels,
    sectorTicks,
  };
};
