# Tasks — Mobile Touch Parity

## 1. Shared touch utilities

- [x] 1.1 Create `web/src/lib/touch.ts`: tap-slop constant (~10 px), a helper deciding whether a `pointerup`/`touchend` qualifies as a tap (single touch, movement under slop), and a `hasCoarsePointer()` media-query check for CSS-defaulting decisions

## 2. Track map — pinch zoom and drag pan (TrackMap.tsx)

- [x] 2.1 Set `touch-action: none` on the map canvas and register non-passive `touchstart`/`touchmove`/`touchend`/`touchcancel` listeners in the same effect as the mouse/wheel listeners, with cleanup
- [x] 2.2 Implement two-finger pinch: incremental scale from finger-distance ratio applied to `zoomRef.level` with the wheel clamp `[1, ZOOM_MAX]`, midpoint-anchored offset via the wheel formula (`o' = m - (m - o) * r`), and midpoint movement translating `(ox, oy)` so a moving pinch pans
- [x] 2.3 Implement one-finger drag pan: translate `(ox, oy)` by the drag delta while `zoomRef.level > 1`; inert at level 1
- [x] 2.4 Reset semantics: gesture ending with level within epsilon of 1 snaps `zoomRef` to `ZOOM_RESET` (and dismisses a detached follow), matching the wheel path
- [x] 2.5 Follow detach: any pinch or pan while `followRef` is `following`/`exiting` calls `setFollow("detached")`, mirroring `onWheel`
- [x] 2.6 Verify gestures only write fresh `Zoom` objects into `zoomRef` so the existing dirty-gating repaints without new animation state

## 3. Track map — tap interactions (TrackMap.tsx)

- [x] 3.1 Tap on canvas (single finger, under slop, no pinch/pan occurred) writes the position into `mouseRef` to drive the existing hit-test/readout/emphasis; tap hitting no line (and any multi-finger `touchstart`) clears `mouseRef`
- [x] 3.2 Follow/exit button: add `onPointerUp` branch for `pointerType === 'touch'` that toggles immediately (`following` ⇄ `exiting`), cancels any running dwell, bypasses `armReadyRef`, and suppresses the post-tap synthesized `mouseenter` from starting a phantom dwell (ignore dwell starts within ~500 ms of a touch toggle)
- [x] 3.3 Confirm mouse dwell path is byte-identical: hover dwell, progress bar, cancel-on-leave, and re-arm guard all unchanged for `pointerType === 'mouse'`

## 4. Panel reveals and in-panel taps

- [x] 4.1 `LapAnalysis.tsx`: tap on the collapsed summary toggles the existing `open` state (render as `open || group-hover`); tap on an open panel's summary/close affordance closes it; lap chips select on touch `pointerup`
- [x] 4.2 `LapAnalysis.tsx` traces: `touch-action: none` on the trace canvas, touch drag writes the scrub position like `onMouseMove`, `touchend`/`touchcancel` clears it like `onMouseLeave`
- [x] 4.3 `LapTimes.tsx`: tap toggles the lap-list flyout open/closed via state alongside `group-hover`; lap-row touch `pointerup` writes `hoveredLapRef` (and clears it when the flyout closes)
- [x] 4.4 `TyreOverlay.tsx` / `InstrumentCluster.tsx`: tap toggles the overlay reveal via state alongside `group-hover`

## 5. Session header (SessionHeader.tsx)

- [x] 5.1 Mobile-first stacking: base classes wrap the title block and pill row on narrow viewports with tighter padding and `truncate`/`min-w-0` on the title and car · driver lines; `sm:` classes restore the current single-row desktop layout verbatim
- [x] 5.2 Suppress `ConnectionBadge` whenever `IS_DEMO` (all viewports) — the demo badge is the status in a replay

## 6. Verification

- [x] 6.1 `npm run lint -w web` and `npm run build -w web` pass
- [x] 6.2 Desktop regression pass with the mock (`npm run mock -w bridge` + dev servers, per the verify skill): wheel zoom, hover readout, dwell follow/exit, panel hovers, header layout all unchanged
- [x] 6.3 Touch pass in a mobile emulator (DevTools device mode or Playwright touch): pinch zoom anchored at midpoint, one-finger pan while zoomed, tap toggles follow **and exit** repeatedly, lap-line tap readout + empty-tap dismiss, panel tap toggles, trace touch scrub, no page scroll/zoom from canvas gestures, header readable at phone width
- [x] 6.4 Real-device judgment call from design Open Questions: decide whether single-finger drag at level 1 stays inert or becomes `pan-y` passthrough for page scrolling — **resolved: stays inert.** The mobile layout never puts the map in a scrollable flow (the page root is `overflow-hidden` and the map's grid row/column is fixed; only the left tile column scrolls internally), so `pan-y` passthrough would have nothing to scroll. Inert keeps taps clean.
