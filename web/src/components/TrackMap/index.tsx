import type { CutEvent, SessionInfo, TelemetryFrame } from "@rivazza/protocol";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LapRecord } from "../../hooks/useLapHistory";
import type { LapRecording } from "../../hooks/useLapRecordings";
import { formatLapTime } from "../../lib/format";
import { CLICK_MODE } from "../../lib/interaction";
import type { ScrubPoint, SectorOwner } from "../../lib/lapAnalysis";
import { COLORED_LAPS, lapColor } from "../../lib/lapColors";

import { createCamera, easeView, fallbackTarget } from "./camera";
import {
  DWELL_FILL_CLASS,
  INSET_MIN_LEVEL,
  LINE_WIDTH,
  ZOOM_RESET,
} from "./constants";
import { attachGestures } from "./gestures";
import { createHitTest } from "./hitTest";
import { createLayers } from "./layers";
import { createLineRecorder } from "./lineRecorder";
import { createMarkers } from "./markers";
import { insetRect, type Inset, type Point, type Zoom } from "./overviewInset";
import { BRAKE, COAST, HOVERED_GREY_LAP, rgb, THROTTLE } from "./palette";
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
import { useFollowControl, type FollowState } from "./useFollowControl";
import { useTrackMapData } from "./useTrackMapData";

type Props = {
  session: SessionInfo;
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  lapsRef: React.RefObject<LapRecord[]>;
  cutsRef: React.RefObject<CutEvent[]>;
  hoveredLapRef: React.RefObject<number | null>;
  scrubRef: React.RefObject<ScrubPoint | null>;
  analysisLapRef: React.RefObject<number | null>;
  recordingsRef: React.RefObject<LapRecording[]>;
  recordingsVersion: number;
};

type LegendEntry = {
  lap: number;
  color: string;
  timeMs: number | null;
  invalid: boolean;
};

export const TrackMap = ({
  session,
  telemetryRef,
  lapsRef,
  cutsRef,
  hoveredLapRef,
  scrubRef,
  analysisLapRef,
  recordingsRef,
  recordingsVersion,
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
  const { mapData, mapProbed } = useTrackMapData(session);
  const { followUi, dwelling, follow } = useFollowControl(telemetryRef);
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

    const {
      edges,
      edgeView,
      edgesFill,
      sectorEdges,
      sectorLabels,
      sectorTicks,
    } = buildTrackGeometry(mapData);

    // The inset as last painted, null while hidden. Handlers hit-test against
    // this, so the hit area is always exactly what is on screen.
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
      // The focused lap: cursor on its line, else its row hovered in the
      // session-lap list, else the open analysis panel's selection. Whatever
      // focused it, the treatment is identical — the line leaves the cached
      // layer and redraws ON TOP with the emphasis stroke (a lap being
      // inspected must never sit buried under later laps), and its brake
      // ticks and cut markers reveal.
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
        // Emphasis keeps the lap's identity color: thicker + full opacity
        // (grey laps brighten to solid white) instead of a separate hue.
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
      // Line-hover echo: a colored ring snapped to the nearest point on the
      // hovered/tapped line — the direct-map twin of the scrub ring. Same
      // pointer state on desktop (mouse) and mobile (a tap parks mouseRef).
      if (hit.marker) {
        const { px, py } = project(hit.marker);
        drawRing(px, py, hit.marker.color);
      }
      if (hit.nearest >= 0) drawHoverReadout(hit);
    };

    // Keep the DOM legend in sync with the colored laps. Times can arrive a
    // few frames after a lap completes (the lap log waits for a fresh
    // lastLapMs), so the entries are rebuilt each frame and pushed to React
    // state only when their key actually changes.
    const syncLegend = () => {
      const laps = previousLapsRef.current;
      const entries = laps
        .slice(Math.max(0, laps.length - COLORED_LAPS))
        .map(({ lap }) => {
          const record = lapsRef.current.find((l) => l.lap === lap);
          return {
            lap,
            color: lapColor(lap),
            timeMs: record?.timeMs ?? null,
            invalid: record?.invalid ?? false,
          };
        })
        .reverse();
      const key = entries
        .map((e) => `${e.lap}:${e.timeMs}:${e.invalid}`)
        .join("|");
      if (key !== legendKeyRef.current) {
        legendKeyRef.current = key;
        setLegend(entries);
      }
    };

    const showsInset = () =>
      zoomRef.current.level >= INSET_MIN_LEVEL && !cameraDrivesView();

    // Dirty gating: repaint only when something rendered actually changed.
    // Telemetry frames, mouse positions, and zoom states are fresh objects on
    // every change, so identity comparison is a faithful change detector.
    let lastFrame: TelemetryFrame | null = null;
    let lastMouse: { x: number; y: number } | null = null;
    let lastZoom = zoomRef.current;
    let lastCuts: CutEvent[] | null = null;
    let lastCutCount = 0;
    let lastHoveredLap: number | null = null;
    let lastScrub: ScrubPoint | null = null;
    let lastAnalysisLap: number | null = null;
    let lastRecVersion = -1;
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;
    let firstDraw = true;
    // Fallback mode keeps repainting while the auto-fit viewport eases.
    let easing = false;
    let lastFollow: FollowState = followRef.current;
    // A wheel/pinch retarget changes only the target window — nothing else the
    // gate watches — and the gate runs *before* followCamera, so without this
    // term the camera wouldn't run and the retarget would sit inert on an
    // otherwise-idle frame (stationary car, no new telemetry, parked cursor).
    let lastFollowWindow = followWindowRef.current;
    let lastNav = navRef.current;

    let lastTickAt = performance.now();
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      // Wall-clock step for the time-based camera easing; capped so a
      // background tab doesn't turn into one giant leap on return.
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
      const dirty =
        firstDraw ||
        easing ||
        followAnimating() ||
        navAnimating() ||
        nav !== lastNav ||
        followState !== lastFollow ||
        followWindow !== lastFollowWindow ||
        frame !== lastFrame ||
        mouse !== lastMouse ||
        zoom !== lastZoom ||
        cutList !== lastCuts ||
        cutList.length !== lastCutCount ||
        hoveredLap !== lastHoveredLap ||
        scrub !== lastScrub ||
        analysisLap !== lastAnalysisLap ||
        recVersion !== lastRecVersion ||
        width !== lastW ||
        height !== lastH ||
        dpr !== lastDpr;
      if (!dirty) return;
      firstDraw = false;
      lastFollow = followState;
      lastFollowWindow = followWindow;
      lastNav = nav;
      lastFrame = frame;
      lastMouse = mouse;
      lastZoom = zoom;
      lastCuts = cutList;
      lastCutCount = cutList.length;
      lastHoveredLap = hoveredLap;
      lastScrub = scrub;
      lastAnalysisLap = analysisLap;
      lastRecVersion = recVersion;
      syncSectorTables();
      lastW = width;
      lastH = height;
      lastDpr = dpr;
      insetRef.current = null;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (frame) lines.ingest(frame, cutList, resetLines);

      syncLegend();

      const fixedFit = mapData?.meta
        ? { mode: "m", base: metaProjection(mapData.meta, width, height) }
        : edgeView
          ? { mode: "e", base: viewProjection(edgeView, width, height) }
          : null;
      if (fixedFit) {
        easing = false;
        const { base } = fixedFit;
        followCamera(base, width, height, dt);
        navCamera(width, height, dt);
        const project: Project = zoomed(base, zoomRef);
        const zm = zoomRef.current;
        insetRef.current = showsInset() ? insetRect(width, height) : null;

        // Everything the projection depends on — a change invalidates layers.
        const fitKey = `${fixedFit.mode}|${width}x${height}@${dpr}`;
        const projKey = `${fitKey}|${zm.level},${zm.ox},${zm.oy}`;
        renderTrackLayer(project, projKey, width, height, dpr);
        drawLaps(project, projKey, width, height, dpr);
        if (frame) drawDot(project, frame);
        drawInset(base, fitKey, width, height, dpr, frame);
        return;
      }

      // No map data at all for this track: auto-fit the driven lines. The
      // viewport eases toward the (margin-padded) bounds so the first lap
      // doesn't pin the car dot against the canvas edges while the extent is
      // still growing.
      if (
        !frame ||
        (currentRef.current.length < 2 && previousLapsRef.current.length === 0)
      ) {
        easing = false;
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
      easing = stillEasing;
      // User zoom multiplies the eased auto-fit view; at 1× the automatic
      // camera behaves exactly as before.
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
    mapData,
    telemetryRef,
    lapsRef,
    cutsRef,
    hoveredLapRef,
    scrubRef,
    analysisLapRef,
    recordingsRef,
    follow,
    lines,
    resetLines,
  ]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col rounded-lg border border-edge bg-surface">
      <p className="absolute top-3 left-4 text-xs tracking-wide text-ink-muted uppercase">
        Track map
      </p>
      <div className="absolute top-3 right-4 flex items-center gap-3 text-xs text-ink-muted">
        {mapProbed && !mapData && (
          <span>No map file — drawing your driving line</span>
        )}
        <span className="flex items-center gap-1">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: rgb(THROTTLE) }}
          />
          Throttle
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: rgb(COAST) }}
          />
          Coast
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: rgb(BRAKE) }}
          />
          Brake
        </span>
      </div>
      {legend.length > 0 && (
        <div className="pointer-events-none absolute right-4 bottom-3 flex flex-col gap-1 text-xs">
          {legend.map((entry) => (
            <span
              key={entry.lap}
              className="flex items-center justify-end gap-1.5"
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="text-ink-muted">Lap {entry.lap}</span>
              {entry.timeMs != null && (
                <span
                  className={`tabular-nums ${entry.invalid ? "text-critical" : "text-ink-secondary"}`}
                >
                  {formatLapTime(entry.timeMs)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-1.5">
        {(followUi === "off" ? hasFrame : followUi !== "exiting") && (
          <button
            type="button"
            onMouseEnter={follow.startDwell}
            onMouseLeave={follow.leaveDwell}
            onPointerDown={(e) => {
              if (e.pointerType === "touch") e.preventDefault();
            }}
            onPointerUp={follow.onFollowActivate}
            title={
              CLICK_MODE
                ? followUi === "off"
                  ? "Click to follow the car"
                  : "Click to leave follow mode"
                : "Rest the cursor here for 1 second — no click needed"
            }
            className={`pointer-events-auto relative overflow-hidden rounded border border-edge bg-surface px-2.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink-secondary ${
              CLICK_MODE ? "cursor-pointer" : ""
            }`}
          >
            {followUi === "off" ? "Follow car" : "Exit follow"}
            <span
              className={`absolute inset-x-0 bottom-0 h-0.5 bg-accent ${
                dwelling
                  ? `w-full transition-[width] ease-linear ${DWELL_FILL_CLASS}`
                  : "w-0"
              }`}
            />
          </button>
        )}
      </div>
      <canvas ref={canvasRef} className="size-full touch-none" />
    </section>
  );
};
