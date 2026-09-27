import type { TelemetryFrame, TrackEdges } from "@rivazza/protocol";

import type { SectorOwner } from "../../lib/lapAnalysis";
import { COLORED_LAPS, lapColor } from "../../lib/lapColors";

import { INSET_CAR_RADIUS, LINE_WIDTH, TIP_HOLDBACK } from "./constants";
import type { Sample, StoredLap } from "./lineRecorder";
import type { Markers } from "./markers";
import {
  baseToInset,
  insideRect,
  viewportInInset,
  type Inset,
  type Point,
  type Rect,
  type Zoom,
} from "./overviewInset";
import {
  bucketColor,
  bucketKey,
  INSET_BORDER,
  INSET_GHOST,
  INSET_GHOST_FILL,
  INSET_VIEWPORT,
  PREVIOUS_LAP,
  SURFACE,
  TRACK_EDGE,
  TRACK_EDGE_WIDTH,
  TRACK_FILL,
} from "./palette";
import {
  affineOf,
  buildLapPath,
  strokeWorldPath,
  type Project,
} from "./projection";
import type { Anchor } from "./trackGeometry";

type LayerDeps = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  edges: TrackEdges | null;
  edgesFill: Path2D | null;
  sectorEdges: { left: Path2D; right: Path2D }[];
  sectorTicks: (Anchor | null)[][];
  currentRef: React.RefObject<Sample[]>;
  previousLapsRef: React.RefObject<StoredLap[]>;
  lapsVersion: () => number;
  sectorOwnersRef: React.RefObject<(SectorOwner | null)[]>;
  sectorKey: () => string;
  drawSectorTick: Markers["drawSectorTick"];
  drawSectorLabel: Markers["drawSectorLabel"];
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  zoomRef: React.RefObject<Zoom>;
  mouseRef: React.RefObject<Point | null>;
  insetRef: React.RefObject<Inset | null>;
  dotWorld: (frame: TelemetryFrame) => { x: number; z: number };
};

export const createLayers = ({
  canvas,
  ctx,
  edges,
  edgesFill,
  sectorEdges,
  sectorTicks,
  currentRef,
  previousLapsRef,
  lapsVersion,
  sectorOwnersRef,
  sectorKey,
  drawSectorTick,
  drawSectorLabel,
  telemetryRef,
  zoomRef,
  mouseRef,
  insetRef,
  dotWorld,
}: LayerDeps) => {
  // Offscreen layers so a typical frame is a few blits plus the segments
  // added since the last one — instead of re-projecting and re-stroking
  // every stored lap. All live only as long as this effect (mapData/session).
  const lapsLayer = document.createElement("canvas");
  const lapsLayerCtx = lapsLayer.getContext("2d");
  const currentLayer = document.createElement("canvas");
  const currentLayerCtx = currentLayer.getContext("2d");
  const trackLayer = document.createElement("canvas");
  const trackLayerCtx = trackLayer.getContext("2d");
  const insetLayer = document.createElement("canvas");
  const insetLayerCtx = insetLayer.getContext("2d");
  if (!lapsLayerCtx || !currentLayerCtx || !trackLayerCtx || !insetLayerCtx)
    return null;

  const sizeLayer = (layer: HTMLCanvasElement, w: number, h: number) => {
    if (layer.width !== w || layer.height !== h) {
      layer.width = w;
      layer.height = h;
    }
  };

  // Layers hold device pixels sized exactly like the main canvas, so they
  // blit 1:1 in device space — pixel-identical to drawing directly.
  const blitLayer = (layer: HTMLCanvasElement) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  };

  // Cache invalidation state. `appendedCount` is how many current-lap
  // samples are already drawn into currentLayer.
  let lapsLayerKey = "";
  let currentLayerKey = "";
  let appendedCount = 0;
  let trackLayerKey = "";
  let insetLayerKey = "";

  // The track-limits ribbon under everything else, and the sector division
  // its edge strokes carry. Edge geometry is static for the session, so the
  // layer re-renders only when the projection changes (zoom, resize, DPR) or
  // when sector ownership does — a lap completing or being invalidated.
  // Every other frame just re-blits it.
  const renderTrackLayer = (
    project: Project,
    projKey: string,
    width: number,
    height: number,
    dpr: number,
  ) => {
    if (!edges || !edgesFill) return;
    const key = `${projKey}|${sectorKey()}`;
    if (key !== trackLayerKey) {
      trackLayerKey = key;
      sizeLayer(trackLayer, canvas.width, canvas.height);
      trackLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      trackLayerCtx.clearRect(0, 0, width, height);

      const aff = affineOf(project);
      trackLayerCtx.save();
      trackLayerCtx.setTransform(
        dpr * aff.k,
        0,
        0,
        dpr * aff.k,
        dpr * aff.tx,
        dpr * aff.ty,
      );
      trackLayerCtx.fillStyle = TRACK_FILL;
      trackLayerCtx.fill(edgesFill);
      trackLayerCtx.restore();

      // The edge strokes are the actual track limits and stay neutral: a
      // lap-identity hue here reads as another driving line and swamps the
      // real ones. The division is carried by outward boundary ticks and by
      // the labels, so nothing is drawn across the asphalt and the only
      // saturated colour on the map is a lap's own line.
      sectorEdges.forEach((sector, s) => {
        for (const path of [sector.left, sector.right])
          strokeWorldPath(
            trackLayerCtx,
            path,
            aff,
            dpr,
            TRACK_EDGE,
            TRACK_EDGE_WIDTH,
          );
        for (const anchor of sectorTicks[s] ?? [])
          drawSectorTick(trackLayerCtx, project, anchor, false);
        drawSectorLabel(
          trackLayerCtx,
          project,
          s,
          sectorOwnersRef.current[s],
          false,
        );
      });
    }
    blitLayer(trackLayer);
  };

  // All completed laps except the hovered one (kept out so the emphasis
  // pass reproduces today's exact skip-and-redraw pixels).
  const renderLapsLayer = (
    project: Project,
    projKey: string,
    hoveredIndex: number,
    width: number,
    height: number,
    dpr: number,
  ) => {
    const laps = previousLapsRef.current;
    const key = `${projKey}|${lapsVersion()}|${hoveredIndex}`;
    if (key === lapsLayerKey) return;
    lapsLayerKey = key;
    sizeLayer(lapsLayer, canvas.width, canvas.height);
    lapsLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lapsLayerCtx.clearRect(0, 0, width, height);
    // The most recent laps carry stable identity colors; older ones stay grey.
    const coloredFrom = Math.max(0, laps.length - COLORED_LAPS);
    const aff = affineOf(project);
    laps.forEach((entry, index) => {
      if (index === hoveredIndex) return;
      const color = index >= coloredFrom ? lapColor(entry.lap) : PREVIOUS_LAP;
      entry.path ??= buildLapPath(entry.samples);
      strokeWorldPath(
        lapsLayerCtx,
        entry.path,
        aff,
        dpr,
        color,
        LINE_WIDTH - 0.5,
      );
    });
  };

  // Current-lap geometry batched into one world-space Path2D per pedal
  // color bucket — projection independent and append-only, so a moving
  // camera restrokes a couple dozen cached paths instead of re-projecting
  // and stroking every segment. `currentPathCount` is how many samples the
  // buckets already contain.
  const currentPaths = new Map<number, Path2D>();
  let currentPathCount = 0;

  // Current lap accumulates incrementally; a projection change (zoom,
  // camera motion, resize) or shrink (rollover/reset) restrokes the cached
  // bucket paths, while a same-projection frame appends only new segments.
  const renderCurrentLayer = (
    project: Project,
    projKey: string,
    width: number,
    height: number,
    dpr: number,
  ) => {
    const samples = currentRef.current;
    // The newest TIP_HOLDBACK samples stay out of the layer — the live tip
    // is drawn per frame by drawCurrentTail, clipped at the dot.
    const layerLen = Math.max(0, samples.length - TIP_HOLDBACK);
    if (layerLen < currentPathCount) {
      currentPaths.clear();
      currentPathCount = 0;
    }
    for (let i = Math.max(1, currentPathCount); i < layerLen; i++) {
      const s = samples[i];
      if (s.jump) continue;
      const key = bucketKey(s.gas, s.brake);
      let path = currentPaths.get(key);
      if (!path) {
        path = new Path2D();
        currentPaths.set(key, path);
      }
      path.moveTo(samples[i - 1].x, samples[i - 1].z);
      path.lineTo(s.x, s.z);
    }
    currentPathCount = Math.max(currentPathCount, layerLen);

    if (projKey !== currentLayerKey || layerLen < appendedCount) {
      currentLayerKey = projKey;
      sizeLayer(currentLayer, canvas.width, canvas.height);
      currentLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      currentLayerCtx.clearRect(0, 0, width, height);
      appendedCount = 0;
    }
    if (layerLen < 2 || layerLen === appendedCount) return;
    if (appendedCount === 0) {
      const aff = affineOf(project);
      for (const [key, path] of currentPaths)
        strokeWorldPath(
          currentLayerCtx,
          path,
          aff,
          dpr,
          bucketColor(key),
          LINE_WIDTH,
        );
    } else {
      currentLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      currentLayerCtx.lineWidth = LINE_WIDTH;
      currentLayerCtx.lineCap = "round";
      for (let i = appendedCount; i < layerLen; i++) {
        if (samples[i].jump) continue;
        const a = project(samples[i - 1]);
        const b = project(samples[i]);
        currentLayerCtx.strokeStyle = bucketColor(
          bucketKey(samples[i].gas, samples[i].brake),
        );
        currentLayerCtx.beginPath();
        currentLayerCtx.moveTo(a.px, a.py);
        currentLayerCtx.lineTo(b.px, b.py);
        currentLayerCtx.stroke();
      }
    }
    appendedCount = layerLen;
  };

  // The live tip of the current lap, drawn directly on the main canvas
  // every repaint: the held-back samples, ending exactly at the dot. While
  // following, the dot runs FOLLOW_DELAY_MS behind the raw stream, and
  // without this clip the line pokes out ahead of it.
  const drawCurrentTail = (project: Project) => {
    const samples = currentRef.current;
    const frame = telemetryRef.current;
    if (!frame || samples.length === 0) return;
    const tip = dotWorld(frame);
    const from = Math.max(1, samples.length - TIP_HOLDBACK);
    // Nearest held-back sample to the dot: segments beyond it are ahead of
    // the dot and stay hidden (samples are ~1 m apart, so this is faithful).
    let end = samples.length - 1;
    let bestD = Infinity;
    for (let i = from - 1; i < samples.length; i++) {
      const d = (samples[i].x - tip.x) ** 2 + (samples[i].z - tip.z) ** 2;
      if (d < bestD) {
        bestD = d;
        end = i;
      }
    }
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = "round";
    for (let i = from; i <= end; i++) {
      if (samples[i].jump) continue;
      const a = project(samples[i - 1]);
      const b = project(samples[i]);
      ctx.strokeStyle = bucketColor(
        bucketKey(samples[i].gas, samples[i].brake),
      );
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    }
    const a = project(samples[end]);
    const b = project(tip);
    ctx.strokeStyle = bucketColor(bucketKey(frame.gas, frame.brake));
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  };

  // The fit-framing track depiction, independent of zoom: zooming and
  // gliding only re-blit it.
  const renderInsetLayer = (
    base: Project,
    fitKey: string,
    at: Inset,
    dpr: number,
  ) => {
    const key = `${fitKey}|${edgesFill ? "" : lapsVersion()}`;
    if (key === insetLayerKey) return;
    insetLayerKey = key;
    sizeLayer(insetLayer, Math.round(at.w * dpr), Math.round(at.h * dpr));
    insetLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
    insetLayerCtx.clearRect(0, 0, insetLayer.width, insetLayer.height);
    const fit = affineOf(base);
    const aff = {
      k: fit.k * at.scale,
      tx: fit.tx * at.scale,
      ty: fit.ty * at.scale,
    };
    if (edgesFill) {
      insetLayerCtx.save();
      insetLayerCtx.setTransform(
        dpr * aff.k,
        0,
        0,
        dpr * aff.k,
        dpr * aff.tx,
        dpr * aff.ty,
      );
      insetLayerCtx.fillStyle = TRACK_FILL;
      insetLayerCtx.fill(edgesFill);
      insetLayerCtx.restore();
      for (const sector of sectorEdges)
        for (const path of [sector.left, sector.right])
          strokeWorldPath(insetLayerCtx, path, aff, dpr, TRACK_EDGE, 1);
      return;
    }
    for (const entry of previousLapsRef.current) {
      entry.path ??= buildLapPath(entry.samples);
      strokeWorldPath(insetLayerCtx, entry.path, aff, dpr, PREVIOUS_LAP, 1);
    }
  };

  const strokeRect = (r: Rect) => {
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  };

  const drawInset = (
    base: Project,
    fitKey: string,
    width: number,
    height: number,
    dpr: number,
    frame: TelemetryFrame | null,
  ) => {
    const at = insetRef.current;
    if (!at) return;
    renderInsetLayer(base, fitKey, at, dpr);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(at.x, at.y, at.w, at.h, 4);
    ctx.fillStyle = SURFACE;
    ctx.fill();
    ctx.clip();
    ctx.drawImage(insetLayer, at.x, at.y, at.w, at.h);
    const zm = zoomRef.current;
    const view = viewportInInset(at, zm, width, height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = INSET_VIEWPORT;
    strokeRect(view);
    const m = mouseRef.current;
    if (m && insideRect(at, m)) {
      const ghost = {
        x: m.x - view.w / 2,
        y: m.y - view.h / 2,
        w: view.w,
        h: view.h,
      };
      ctx.fillStyle = INSET_GHOST_FILL;
      ctx.fillRect(ghost.x, ghost.y, ghost.w, ghost.h);
      ctx.strokeStyle = INSET_GHOST;
      strokeRect(ghost);
    }
    if (frame) {
      const { px, py } = base(dotWorld(frame));
      const car = baseToInset(at, { x: px, y: py });
      ctx.beginPath();
      ctx.arc(car.x, car.y, INSET_CAR_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(at.x + 0.5, at.y + 0.5, at.w - 1, at.h - 1, 4);
    ctx.lineWidth = 1;
    ctx.strokeStyle = INSET_BORDER;
    ctx.stroke();
  };

  return {
    lapsLayer,
    currentLayer,
    blitLayer,
    renderTrackLayer,
    renderLapsLayer,
    renderCurrentLayer,
    drawCurrentTail,
    drawInset,
  };
};
