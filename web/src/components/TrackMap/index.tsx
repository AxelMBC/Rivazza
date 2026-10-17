import type { CutEvent, SessionInfo, TelemetryFrame } from "@rivazza/protocol";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LapRecord } from "../../hooks/useLapHistory";
import type { LapRecording } from "../../hooks/useLapRecordings";
import type { Telemetry } from "../../hooks/useTelemetry";
import type { ScrubPoint, SectorOwner } from "../../lib/lapAnalysis";
import { COLORED_LAPS, lapColor } from "../../lib/lapColors";
import { hasCoarsePointer } from "../../lib/touch";

import { createCamera, easeView, fallbackTarget } from "./camera";
import { INSET_MIN_LEVEL, LINE_WIDTH, ZOOM_RESET } from "./constants";
import { FollowButton } from "./FollowButton";
import { attachGestures } from "./gestures";
import { createHitTest } from "./hitTest";
import { LapLegend } from "./LapLegend";
import { createLayers } from "./layers";
import { legendEntries, legendKey, type LegendEntry } from "./legend";
import { createLineRecorder } from "./lineRecorder";
import { createMarkers } from "./markers";
import { insetRect, type Inset, type Point, type Zoom } from "./overviewInset";
import { HOVERED_GREY_LAP } from "./palette";
import { PedalKey } from "./PedalKey";
import {
  affineOf,
  buildLapPath,
  metaProjection,
  strokeWorldPath,
  viewProjection,
  zoomed,
  type Project,
} from "./projection";
import { buildTrackGeometry, type View } from "./trackGeometry";
import { useFollowControl } from "./useFollowControl";

type Props = {
  session: SessionInfo;
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  subscribeFrame: Telemetry["subscribeFrame"];
  lapsRef: React.RefObject<LapRecord[]>;
  cutsRef: React.RefObject<CutEvent[]>;
  hoveredLapRef: React.RefObject<number | null>;
  scrubRef: React.RefObject<ScrubPoint | null>;
  analysisLapRef: React.RefObject<number | null>;
  recordingsRef: React.RefObject<LapRecording[]>;
  recordingsVersion: number;
  className?: string;
};

export const TrackMap = ({
  session,
  telemetryRef,
  subscribeFrame,
  lapsRef,
  cutsRef,
  hoveredLapRef,
  scrubRef,
  analysisLapRef,
  recordingsRef,
  recordingsVersion,
  className = "",
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingsVersionRef = useRef(recordingsVersion);
  recordingsVersionRef.current = recordingsVersion;
  const sectorOwnersRef = useRef<(SectorOwner | null)[]>([]);
  const [lines] = useState(createLineRecorder);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const viewRef = useRef<View | null>(null);
  const zoomRef = useRef<Zoom>(ZOOM_RESET);
  const navRef = useRef<Point | null>(null);
  const { followUi, dwelling, follow } = useFollowControl(telemetryRef);
  const { meta, edges } = session;
  const hasFrameRef = useRef(false);
  const legendKeyRef = useRef("");

  const [hasFrame, setHasFrame] = useState(false);
  const [legend, setLegend] = useState<LegendEntry[]>([]);

  const resetLines = useCallback(() => {
    lines.reset();
    viewRef.current = null;
    zoomRef.current = ZOOM_RESET;
    navRef.current = null;
    follow.resetFollow();
  }, [lines, follow]);

  useEffect(() => resetLines(), [session, resetLines]);

  useEffect(
    () =>
      subscribeFrame((frame) =>
        lines.ingest(frame, cutsRef.current, resetLines),
      ),
    [subscribeFrame, lines, cutsRef, resetLines],
  );

  useEffect(() => {
    const {
      followRef,
      setFollow,
      followWindowRef,
      followLimitsRef,
      cameraDrivesView,
      retargetFollow,
    } = follow;
    const { currentRef, previousLapsRef, currentCutRef, boundsRef, anchorRef } =
      lines;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let rafId = 0;

    const { edgeView, edgesFill, sectorEdges, sectorLabels, sectorTicks } =
      buildTrackGeometry(meta, edges);

    const insetRef: React.RefObject<Inset | null> = { current: null };
    const { followCamera, navCamera, dotWorld, followAnimating, navAnimating } =
      createCamera({
        telemetryRef,
        zoomRef,
        navRef,
        followRef,
        setFollow,
        followWindowRef,
        followLimitsRef,
        cameraDrivesView,
      });

    const {
      drawSectorTick,
      drawSectorLabel,
      sectorKey,
      syncSectorTables,
      drawRing,
      drawScrubSector,
      drawScrubMarker,
      drawCutMarkers,
      drawDot,
    } = createMarkers({
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
    });
    const layers = createLayers({
      canvas,
      ctx,
      edges,
      edgesFill,
      sectorEdges,
      sectorTicks,
      currentRef,
      previousLapsRef,
      lapsVersion: lines.lapsVersion,
      sectorOwnersRef,
      sectorKey,
      drawSectorTick,
      drawSectorLabel,
      telemetryRef,
      zoomRef,
      mouseRef,
      insetRef,
      dotWorld,
    });
    if (!layers) return;
    const {
      lapsLayer,
      currentLayer,
      blitLayer,
      renderTrackLayer,
      renderLapsLayer,
      renderCurrentLayer,
      drawCurrentTail,
      drawInset,
    } = layers;
    const { hitTestLaps, drawHoverReadout, setCursor } = createHitTest({
      canvas,
      ctx,
      mouseRef,
      previousLapsRef,
      lapsRef,
      insetRef,
      cameraDrivesView,
    });

    const drawLaps = (
      project: Project,
      projKey: string,
      width: number,
      height: number,
      dpr: number,
    ) => {
      const hit = hitTestLaps(project);
      setCursor(hit.nearest >= 0 ? "pointer" : "default");
      const laps = previousLapsRef.current;
      let focus = hit.nearest;
      if (focus < 0) {
        const externalLap = hoveredLapRef.current ?? analysisLapRef.current;
        if (externalLap !== null)
          focus = laps.findIndex((l) => l.lap === externalLap);
      }
      renderLapsLayer(project, projKey, focus, width, height, dpr);
      blitLayer(lapsLayer);
      renderCurrentLayer(project, projKey, width, height, dpr);
      blitLayer(currentLayer);
      drawCurrentTail(project);
      if (focus >= 0) {
        const coloredFrom = Math.max(0, laps.length - COLORED_LAPS);
        const entry = laps[focus];
        const color =
          focus >= coloredFrom ? lapColor(entry.lap) : HOVERED_GREY_LAP;
        entry.path ??= buildLapPath(entry.samples);
        strokeWorldPath(
          ctx,
          entry.path,
          affineOf(project),
          dpr,
          color,
          LINE_WIDTH + 1,
        );
      }
      drawScrubSector(project, affineOf(project), dpr);
      drawCutMarkers(project, focus);
      drawScrubMarker(project);
      if (hit.marker) {
        const { px, py } = project(hit.marker);
        drawRing(px, py, hit.marker.color);
      }
      if (hit.nearest >= 0) drawHoverReadout(hit);
    };

    const syncLegend = () => {
      const entries = legendEntries(previousLapsRef.current, lapsRef.current);
      const key = legendKey(entries);
      if (key !== legendKeyRef.current) {
        legendKeyRef.current = key;
        setLegend(entries);
      }
    };

    const finePointer = !hasCoarsePointer();
    const showsInset = () =>
      finePointer &&
      zoomRef.current.level >= INSET_MIN_LEVEL &&
      !cameraDrivesView();

    let lastInputs: readonly unknown[] | null = null;
    let fallbackEasing = false;

    let lastTickAt = performance.now();
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      // Capped: rAF pauses in a background tab, so the first step back
      // would otherwise be one giant leap.
      const tickAt = performance.now();
      const dt = Math.min(0.1, (tickAt - lastTickAt) / 1000);
      lastTickAt = tickAt;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const frame = telemetryRef.current;
      if ((frame !== null) !== hasFrameRef.current) {
        hasFrameRef.current = frame !== null;
        setHasFrame(frame !== null);
      }
      const mouse = mouseRef.current;
      const zoom = zoomRef.current;
      const cutList = cutsRef.current;
      const hoveredLap = hoveredLapRef.current;
      const scrub = scrubRef.current;
      const analysisLap = analysisLapRef.current;
      const recVersion = recordingsVersionRef.current;
      const followState = followRef.current;
      const followWindow = followWindowRef.current;
      const nav = navRef.current;
      const inputs = [
        nav,
        followState,
        followWindow,
        frame,
        mouse,
        zoom,
        cutList,
        cutList.length,
        hoveredLap,
        scrub,
        analysisLap,
        recVersion,
        width,
        height,
        dpr,
      ];
      const previous = lastInputs;
      const dirty =
        previous === null ||
        fallbackEasing ||
        followAnimating() ||
        navAnimating() ||
        inputs.some((v, i) => v !== previous[i]);
      if (!dirty) return;
      lastInputs = inputs;
      syncSectorTables();
      insetRef.current = null;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      syncLegend();

      const fixedFit = meta
        ? { mode: "m", base: metaProjection(meta, width, height) }
        : edgeView
          ? { mode: "e", base: viewProjection(edgeView, width, height) }
          : null;
      if (fixedFit) {
        fallbackEasing = false;
        const { base } = fixedFit;
        followCamera(base, width, height, dt);
        navCamera(width, height, dt);
        const project: Project = zoomed(base, zoomRef);
        const zm = zoomRef.current;
        insetRef.current = showsInset() ? insetRect(width, height) : null;

        const fitKey = `${fixedFit.mode}|${width}x${height}@${dpr}`;
        const projKey = `${fitKey}|${zm.level},${zm.ox},${zm.oy}`;
        renderTrackLayer(project, projKey, width, height, dpr);
        drawLaps(project, projKey, width, height, dpr);
        if (frame) drawDot(project, frame);
        drawInset(base, fitKey, width, height, dpr, frame);
        return;
      }

      const nothingDrivenYet =
        currentRef.current.length < 2 && previousLapsRef.current.length === 0;
      if (!frame || nothingDrivenYet) {
        fallbackEasing = false;
        return;
      }
      const { view, easing: stillEasing } = easeView(
        viewRef,
        fallbackTarget(
          boundsRef.current,
          anchorRef.current,
          previousLapsRef.current.length === 0,
        ),
      );
      fallbackEasing = stillEasing;
      const base = viewProjection(view, width, height);
      followCamera(base, width, height, dt);
      const project: Project = zoomed(base, zoomRef);

      const zm = zoomRef.current;
      const projKey = `f|${width}x${height}@${dpr}|${zm.level},${zm.ox},${zm.oy}|${view.cx},${view.cz},${view.ex},${view.ez}`;
      drawLaps(project, projKey, width, height, dpr);
      drawDot(project, frame);
    };

    const detachGestures = attachGestures(canvas, {
      insetRef,
      mouseRef,
      zoomRef,
      navRef,
      followRef,
      setFollow,
      followWindowRef,
      followLimitsRef,
      retargetFollow,
      cameraDrivesView,
    });

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      detachGestures();
    };
  }, [
    meta,
    edges,
    telemetryRef,
    lapsRef,
    cutsRef,
    hoveredLapRef,
    scrubRef,
    analysisLapRef,
    recordingsRef,
    follow,
    lines,
  ]);

  return (
    <section
      className={`relative flex min-h-0 flex-1 flex-col rounded-lg border border-edge bg-surface ${className}`}
    >
      <p className="absolute top-3 left-4 text-xs tracking-wide text-ink-muted uppercase">
        Track map
      </p>
      <div className="absolute top-3 right-4 flex items-center gap-3 text-xs text-ink-muted">
        {!meta && !edges && (
          <span>No map file — drawing your driving line</span>
        )}
        <PedalKey />
      </div>
      <LapLegend entries={legend} />
      <FollowButton
        followUi={followUi}
        dwelling={dwelling}
        hasFrame={hasFrame}
        follow={follow}
      />
      <canvas ref={canvasRef} className="size-full touch-none" />
    </section>
  );
};
