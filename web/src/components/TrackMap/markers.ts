import type { TelemetryFrame } from "@rivazza/protocol";

import type { LapRecord } from "../../hooks/useLapHistory";
import type { LapRecording } from "../../hooks/useLapRecordings";
import {
  SECTOR_COUNT,
  sectorOwners,
  type ScrubPoint,
  type SectorOwner,
} from "../../lib/lapAnalysis";
import { lapColor } from "../../lib/lapColors";

import {
  ANCHOR_SNAP_M,
  CUT_ARM,
  CUT_HALO_WIDTH,
  CUT_WIDTH,
  DOT_RADIUS,
  HEADING_BASELINE_M,
  STEER_FULL_DEG,
  STEER_TICK_LEN,
} from "./constants";
import type { CutMarker, StoredLap } from "./lineRecorder";
import {
  HOVERED_GREY_LAP,
  INVALID_TIME,
  SECTOR_EDGE_HOVER,
  SECTOR_LABEL_FONT,
  SECTOR_LABEL_FONT_ON,
  SECTOR_LABEL_HALO,
  SECTOR_LABEL_IDLE,
  SECTOR_LABEL_OFFSET,
  SECTOR_TICK,
  SECTOR_TICK_LEN,
  SECTOR_TICK_WIDTH,
  STEER_TICK_COLOR,
  SURFACE,
  TRACK_EDGE_WIDTH,
} from "./palette";
import { strokeWorldPath, type Affine, type Project } from "./projection";
import type { Anchor } from "./trackGeometry";

type MarkerDeps = {
  ctx: CanvasRenderingContext2D;
  sectorEdges: { left: Path2D; right: Path2D }[];
  sectorLabels: (Anchor | null)[];
  sectorTicks: (Anchor | null)[][];
  previousLapsRef: React.RefObject<StoredLap[]>;
  currentCutRef: React.RefObject<CutMarker | null>;
  sectorOwnersRef: React.RefObject<(SectorOwner | null)[]>;
  recordingsRef: React.RefObject<LapRecording[]>;
  recordingsVersionRef: React.RefObject<number>;
  lapsRef: React.RefObject<LapRecord[]>;
  scrubRef: React.RefObject<ScrubPoint | null>;
  dotWorld: (frame: TelemetryFrame) => { x: number; z: number };
};

export const createMarkers = ({
  ctx,
  sectorEdges,
  sectorLabels,
  sectorTicks,
  previousLapsRef,
  currentCutRef,
  sectorOwnersRef,
  recordingsRef,
  recordingsVersionRef,
  lapsRef,
  scrubRef,
  dotWorld,
}: MarkerDeps) => {
  // The sector's number and its owning lap, set off the asphalt. The lap
  // number is on the map deliberately: the identity palette is shorter than
  // the sector count, so two sectors can share a hue and colour alone cannot
  // name an owner. Offsetting 1 m along the outward world direction fixes
  // the label's screen direction, keeping its distance from the edge
  // constant at any zoom.
  // Projecting the anchor and a point 1 m along its outward direction turns
  // a world direction into a screen one, so a tick or a label keeps the same
  // distance from the track edge at every zoom level.
  const outwardScreen = (project: Project, anchor: Anchor) => {
    const a = project(anchor);
    const n = project({ x: anchor.x + anchor.dx, z: anchor.z + anchor.dz });
    const len = Math.hypot(n.px - a.px, n.py - a.py);
    if (len === 0) return null;
    return { ...a, ux: (n.px - a.px) / len, uy: (n.py - a.py) / len };
  };

  // A boundary mark that grows outward from the edge and never onto the
  // asphalt — the racing line is what the map is for, and a mark across it
  // both hides it and reads as a braking or cut marker.
  const drawSectorTick = (
    target: CanvasRenderingContext2D,
    project: Project,
    anchor: Anchor | null,
    emphasized: boolean,
  ) => {
    if (!anchor) return;
    const o = outwardScreen(project, anchor);
    if (!o) return;
    const len = emphasized ? SECTOR_TICK_LEN * 1.6 : SECTOR_TICK_LEN;
    target.strokeStyle = emphasized ? SECTOR_EDGE_HOVER : SECTOR_TICK;
    target.lineWidth = SECTOR_TICK_WIDTH;
    target.lineCap = "round";
    target.beginPath();
    target.moveTo(o.px, o.py);
    target.lineTo(o.px + o.ux * len, o.py + o.uy * len);
    target.stroke();
  };

  // The owning lap is named in text rather than painted onto the track: the
  // identity palette is shorter than the sector count, so colour alone could
  // not name an owner anyway, and hues on the edges drown the driving lines.
  const drawSectorLabel = (
    target: CanvasRenderingContext2D,
    project: Project,
    sector: number,
    owner: SectorOwner | null,
    emphasized: boolean,
  ) => {
    const anchor = sectorLabels[sector];
    if (!anchor) return;
    const o = outwardScreen(project, anchor);
    if (!o) return;
    const px = o.px + o.ux * SECTOR_LABEL_OFFSET;
    const py = o.py + o.uy * SECTOR_LABEL_OFFSET;
    const text = owner
      ? `S${sector + 1} · L${owner.lap}${owner.invalid ? " INV" : ""}`
      : `S${sector + 1}`;
    target.font = emphasized ? SECTOR_LABEL_FONT_ON : SECTOR_LABEL_FONT;
    target.textAlign = "center";
    target.textBaseline = "middle";
    target.lineJoin = "round";
    target.lineWidth = SECTOR_LABEL_HALO;
    target.strokeStyle = SURFACE;
    target.strokeText(text, px, py);
    target.fillStyle = owner?.invalid
      ? INVALID_TIME
      : emphasized
        ? HOVERED_GREY_LAP
        : owner
          ? lapColor(owner.lap)
          : SECTOR_LABEL_IDLE;
    target.fillText(text, px, py);
    target.textAlign = "left";
    target.textBaseline = "alphabetic";
  };

  // Gate geometry and slice ownership change only when a lap is recorded or
  // logged, never per frame. A lap's log entry lands a few frames after its
  // recording is stored, so the log's length is part of the key too — the
  // recordings version alone would keep a just-invalidated lap owning slices.
  let sectorKey = "";
  const syncSectorTables = () => {
    const recordings = recordingsRef.current;
    const laps = lapsRef.current;
    const key = `${recordingsVersionRef.current}|${laps.length}`;
    if (key === sectorKey) return;
    sectorKey = key;
    sectorOwnersRef.current = sectorOwners(recordings, laps, SECTOR_COUNT);
  };

  // Shared by the analysis-panel scrub echo and the direct line-hover
  // marker so the two read as the same cue everywhere.
  const drawRing = (px: number, py: number, color: string) => {
    for (const [style, width] of [
      [SURFACE, 4.5],
      [color, 2.5],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  // The sector under the analysis panel's cursor, re-stroked over the
  // blitted layer. The panel resolves the pointer to a sector and publishes
  // it, so the band in the panel and the emphasis here cannot disagree.
  const drawScrubSector = (project: Project, aff: Affine, dpr: number) => {
    const scrub = scrubRef.current;
    const sector = scrub ? sectorEdges[scrub.slice] : undefined;
    if (!scrub || !sector) return;
    for (const path of [sector.left, sector.right])
      strokeWorldPath(ctx, path, aff, dpr, SECTOR_EDGE_HOVER, TRACK_EDGE_WIDTH);
    for (const anchor of sectorTicks[scrub.slice] ?? [])
      drawSectorTick(ctx, project, anchor, true);
    drawSectorLabel(
      ctx,
      project,
      scrub.slice,
      sectorOwnersRef.current[scrub.slice],
      true,
    );
  };

  const drawScrubMarker = (project: Project) => {
    const s = scrubRef.current;
    if (!s) return;
    const { px, py } = project(s);
    drawRing(px, py, s.color);
  };

  // Cut markers are stroked directly on every repaint — a session holds at
  // most a handful, so projecting them is far cheaper than another layer.
  const strokeCross = (
    px: number,
    py: number,
    color: string,
    width: number,
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px - CUT_ARM, py - CUT_ARM);
    ctx.lineTo(px + CUT_ARM, py + CUT_ARM);
    ctx.moveTo(px - CUT_ARM, py + CUT_ARM);
    ctx.lineTo(px + CUT_ARM, py - CUT_ARM);
    ctx.stroke();
  };

  const drawCutMarker = (px: number, py: number) => {
    strokeCross(px, py, SURFACE, CUT_HALO_WIDTH); // halo keeps the × readable on any layer
    strokeCross(px, py, INVALID_TIME, CUT_WIDTH);
  };

  // Only the in-progress lap's marker is ambient (it leaves with the lap at
  // the line). A stored lap reveals its marker when focused — line hover,
  // session-lap-list row, or the open analysis panel's selection.
  const drawCutMarkers = (project: Project, focusIndex: number) => {
    const focused = previousLapsRef.current[focusIndex]?.cut;
    for (const c of [focused, currentCutRef.current]) {
      if (!c) continue;
      const { px, py } = project(c);
      drawCutMarker(px, py);
    }
  };

  // Heading anchors for the car marker: previous and newest rendered-dot
  // world positions, at least HEADING_BASELINE_M apart. A teleport-sized
  // jump discards them, so the marker never sweeps across a restart — it
  // falls back to the circle until fresh motion re-establishes heading.
  let headingFrom: { x: number; z: number } | null = null;
  let headingTo: { x: number; z: number } | null = null;

  const trackHeading = (pos: { x: number; z: number }) => {
    if (!headingTo) {
      headingTo = pos;
      return;
    }
    const moved = Math.hypot(pos.x - headingTo.x, pos.z - headingTo.z);
    if (moved > ANCHOR_SNAP_M) {
      headingFrom = null;
      headingTo = pos;
    } else if (moved >= HEADING_BASELINE_M) {
      headingFrom = headingTo;
      headingTo = pos;
    }
  };

  // Screen-space heading: both anchors go through the active projection and
  // the angle is measured between the projected pixels, so it stays correct
  // in every projection mode, at any zoom, and on X-mirrored tracks. Null
  // until two anchors exist.
  const markerAngle = (project: Project): number | null => {
    if (!headingFrom || !headingTo) return null;
    const a = project(headingFrom);
    const b = project(headingTo);
    return Math.atan2(b.py - a.py, b.px - a.px);
  };

  // The car marker: a wedge pointing along the direction of travel with a
  // steering tick pivoting at its nose — or the plain circle while no
  // heading exists (fresh session, never moved, just teleported).
  const drawDot = (project: Project, frame: TelemetryFrame) => {
    const pos = dotWorld(frame);
    trackHeading(pos);
    const { px, py } = project(pos);
    const angle = markerAngle(project);
    if (angle === null) {
      ctx.beginPath();
      ctx.arc(px, py, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = SURFACE;
      ctx.stroke();
      return;
    }
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    // Wedge in local screen px, nose along +x (rotation puts +x on the
    // heading); footprint matches the old circle.
    const nose = DOT_RADIUS + 2;
    ctx.beginPath();
    ctx.moveTo(nose, 0);
    ctx.lineTo(-DOT_RADIUS, DOT_RADIUS - 1);
    ctx.lineTo(-DOT_RADIUS * 0.45, 0);
    ctx.lineTo(-DOT_RADIUS, -(DOT_RADIUS - 1));
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = SURFACE;
    ctx.stroke();
    // Steering tick. Positive steerAngle (right input) rotates clockwise
    // in the canvas's down-positive-y frame — right of the nose on screen —
    // unless the projection is mirrored (negative handedness), which flips
    // the visual turn direction, so the tick flips with it.
    const ux = project({ x: pos.x + 1, z: pos.z });
    const uz = project({ x: pos.x, z: pos.z + 1 });
    const handed =
      (ux.px - px) * (uz.py - py) - (ux.py - py) * (uz.px - px) < 0 ? -1 : 1;
    const frac = Math.max(-1, Math.min(1, frame.steerAngle / STEER_FULL_DEG));
    const tick = frac * (Math.PI / 2) * handed;
    ctx.beginPath();
    ctx.moveTo(nose, 0);
    ctx.lineTo(
      nose + Math.cos(tick) * STEER_TICK_LEN,
      Math.sin(tick) * STEER_TICK_LEN,
    );
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = STEER_TICK_COLOR;
    ctx.stroke();
    ctx.restore();
  };

  return {
    drawSectorTick,
    drawSectorLabel,
    sectorKey: () => sectorKey,
    syncSectorTables,
    drawRing,
    drawScrubSector,
    drawScrubMarker,
    drawCutMarkers,
    drawDot,
  };
};
export type Markers = ReturnType<typeof createMarkers>;
