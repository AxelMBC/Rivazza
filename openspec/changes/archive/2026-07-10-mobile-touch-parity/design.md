# Design — Mobile Touch Parity

## Context

Every interaction in the web app is hover/wheel-driven by deliberate design: on the gaming PC, a click would focus the browser and steal controller input from Assetto Corsa. That rationale is desktop-specific. On a phone or tablet (the realistic mobile use case: a pit-display second screen), the game isn't running on the device, so taps are harmless — but the app handles zero touch events. Today mobile survives on the compatibility mouse events browsers synthesize from taps, which:

- makes the follow-cam **entry** work by accident (tap → synthesized `mouseenter` → the "cursor" parks → the 3 s dwell completes),
- makes the follow-cam **exit** dead: after entry, `armReadyRef` is `false` and only `onMouseLeave` (never fired by touch) re-arms it — `TrackMap.tsx` `startDwell`/`leaveDwell`,
- provides no pinch zoom (only `wheel` is handled) and no way to pan,
- makes hover-revealed panels (`group-hover` CSS, `onMouseEnter` handlers) open on tap but stick until a tap lands somewhere else,
- makes analysis-trace scrubbing impossible (finger drag scrolls the page; `touchmove` synthesizes no `mousemove`).

Constraints from the codebase:

- All canvas components dirty-gate their rAF loops; gesture state must feed the existing dirty checks (fresh object identity in `zoomRef` / `mouseRef`) rather than force repaints.
- The zoom transform is screen-space over a base fit projection (`zoomed = base * level + (ox, oy)`), points scaled rather than the canvas transform — pinch and pan are pure `zoomRef` mutations, exactly like wheel zoom and the follow camera.
- Desktop behavior must be byte-identical: the hover-only rule stays authoritative for mouse pointers.

## Goals / Non-Goals

**Goals:**

- Every hover-triggered feature has a touch-native equivalent on touch devices.
- Fix the two reported bugs: dead "Exit follow" tap, missing pinch zoom.
- Pinch zoom + one-finger pan on the track map with wheel-equivalent semantics (clamp, midpoint anchor, fully-out reset, follow-cam detach).
- Tap-to-toggle for hover-revealed surfaces (lap list flyout, analysis panel, tyre overlay, follow/exit buttons) and tap-to-inspect for lap lines.
- Touch scrub on the analysis traces without page scrolling.
- Preserve desktop hover-only behavior and render idling untouched.

**Non-Goals:**

- No mobile-specific layout redesign (the grid already adapts; a previous commit fixed viewport proportions).
- No hybrid-device arbitration beyond per-event pointer type (a touchscreen laptop simply gets both models, each driven by the pointer actually used).
- No multi-touch beyond two-finger pinch (no rotate, no two-finger pan distinct from pinch — the pinch midpoint moving *is* the pan).
- No changes to bridge, wire protocol, or types.

## Decisions

### 1. Per-event pointer type, not a device-level mode switch

Interaction handlers branch on the gesture's own modality — Pointer Events' `pointerType === 'touch'` (or the event being a `TouchEvent`) — rather than a global `matchMedia('(pointer: coarse)')` flag. A touchscreen laptop then behaves correctly with both input methods, and there is no mode state to get stale. `(hover: none)`/`(pointer: coarse)` media queries are used only where CSS alone drives the reveal (`group-hover` blocks) and for defaulting, not as the source of truth for handlers.

*Alternative considered*: a `useIsTouchDevice()` hook gating all handlers. Rejected — wrong on hybrids, and it turns one render-time boolean into a device-wide behavioral fork that's harder to test.

### 2. Touch gestures on the map canvas via `touchstart/touchmove/touchend` (non-passive), mutating `zoomRef` directly

The canvas gets touch listeners registered alongside the existing mouse/wheel listeners inside the same effect:

- **Pinch (two fingers)**: on each `touchmove`, scale = current finger distance ÷ distance at gesture start (incremental, frame-over-frame), applied to `zoomRef.level` with the same `[1, ZOOM_MAX]` clamp as wheel; the anchor formula is the wheel formula with the pinch midpoint in place of the cursor: `o' = m - (m - o) * r`. Midpoint *movement* between frames additionally translates `(ox, oy)` — so a moving pinch pans for free, matching platform-native map behavior.
- **Pan (one finger, level > 1)**: `touchmove` deltas translate `(ox, oy)` directly. At level 1 a single-finger drag does nothing (the fit view has nowhere to pan), keeping taps clean.
- **Clamping pan**: reuse the wheel-zoom convention — no hard viewport clamp exists today for wheel zoom offsets, so pan gets none either (consistency over invention).
- **Reset**: pinching fully out to level 1 snaps `zoomRef` to `ZOOM_RESET` exactly like wheel; a detached follow dismisses to `off`, mirroring `onWheel`.
- **Follow detach**: any pinch or pan while `following`/`exiting` calls `setFollow("detached")` — the same rule as wheel input.
- `touch-action: none` on the canvas plus `preventDefault()` in the non-passive listeners stops page scroll/browser zoom originating on the canvas.

All of this only writes fresh `Zoom` objects into `zoomRef`, so the existing `zoom !== lastZoom` dirty check repaints exactly when needed — no new animation state.

*Alternative considered*: Pointer Events with manual two-pointer bookkeeping. Equivalent power, but touch events give the two-finger list for free (`e.touches`) and we never need pressure/pen data; mixing `setPointerCapture` with the existing mouse listeners risks disturbing the desktop path.

### 3. Tap semantics on the canvas: readout pick on tap, dismiss on empty tap

A `touchend` that moved less than a slop radius (~10 px) and involved one finger is a *tap*. A tap writes the position into `mouseRef` (the existing hover-pick machinery does the rest: nearest-line hit test, emphasis, readout). A tap that hits nothing clears `mouseRef`. Gestures that panned/pinched never touch `mouseRef`. `mouseRef` is also cleared on `touchstart` of any multi-finger gesture so a readout doesn't linger mid-pinch.

This reuses `hitTestLaps`/`drawHoverReadout` unchanged — the readout is already drawn from `mouseRef` every dirty frame.

### 4. Follow/exit button: tap toggles instantly on touch

The button gets an `onPointerUp` handler: if `pointerType === 'touch'`, it acts immediately — `setFollow('following')` or `'exiting'` per current state — bypassing the dwell and the `armReadyRef` guard entirely (both exist purely to protect mouse users from accidental clicks/toggles; a deliberate tap needs no protection). Mouse pointers fall through to the existing dwell handlers untouched. The synthesized `mouseenter` a tap also fires is neutralized because the tap has already toggled the state — `startDwell`'s `armReadyRef` guard and the state swap make the stray dwell a no-op; we additionally cancel any running dwell on touch toggle.

*Alternative considered*: shortening the dwell on touch (e.g. 500 ms press-and-hold). Rejected — hold gestures fight the browser's long-press behaviors (context menu, text selection) and there's no accidental-hover hazard to defend against on touch.

### 5. Hover-revealed panels: state-driven toggle instead of pure CSS `group-hover`

`LapTimes` flyout, `LapAnalysis` panel, and `TyreOverlay` currently reveal via `group-hover` CSS and/or `onMouseEnter`/`onMouseLeave`. Each gains a small `open` state (LapAnalysis already has one) that a touch `pointerup` on the collapsed summary toggles. Rendering becomes `open || group-hover` — on desktop the CSS path is untouched; on touch the state path drives it deterministically instead of the browser's sticky emulated hover. Tapping the summary again (or a dedicated close affordance where the summary is covered by the open panel) closes it. Inside the open surfaces, row/chip `onMouseEnter` handlers get `onPointerUp`-on-touch equivalents writing the same refs (`hoveredLapRef`, `setSelectedLap`).

### 6. Analysis-trace scrub via touch events on the trace canvas

The trace canvas gets the same treatment as the map canvas: `touch-action: none`, non-passive `touchmove` writing the scrub position exactly like `onMouseMove` does, `touchend` clearing it like `onMouseLeave`. One-finger drag over the traces scrubs; the page never scrolls from inside the traces.

### 7. Session header: mobile-first classes with `sm:` restoring today's desktop layout

`SessionHeader.tsx` keeps one DOM structure; the base (mobile) classes stack the title block and pill row with tighter padding and `truncate` on the title/car lines, and `sm:`-prefixed classes reproduce the current single-row layout exactly. Because desktop styling moves verbatim behind `sm:`, the ≥640 px rendering cannot drift. The connection badge is simply not rendered when `IS_DEMO` — the demo badge is the status in a replay, and "Live" next to "Demo replay" was contradictory on every viewport.

### 8. Small shared helper, not a framework

A tiny `web/src/lib/touch.ts` exports the shared bits: the tap-slop constant, `isTouchEvent`-style guards, and a `hasCoarsePointer()` media-query check for CSS-defaulting decisions. No gesture library — the two gestures needed (pinch, drag) are ~40 lines against the existing zoom math, and a dependency would fight the dirty-gating and ref-based architecture.

## Risks / Trade-offs

- **[Synthesized mouse events double-firing after taps]** Browsers fire `mouseenter/mousemove/click` ~300 ms after a tap; a tap on the follow button could start a phantom dwell, or a canvas tap could re-set `mouseRef`. → `preventDefault()` on handled `touchend`s suppresses the compatibility events where possible; where not (button focus), handlers are idempotent against the post-toggle state, and dwell start is skipped when the last touch interaction was < 500 ms ago.
- **[Pinch precision at clamp boundaries]** Incremental scaling can oscillate around level 1. → snap-to-`ZOOM_RESET` epsilon band (e.g. level < 1.02 on gesture end), mirroring the wheel path's exact-1 reset.
- **[`touch-action: none` on the map canvas swallows page scrolling]** On small screens the map fills much of the viewport; a user trying to scroll the page from the map can't. → the mobile layout already gives each column its own scroll region and the map is `flex-1` (not inside a scroll flow); single-finger drag at level 1 is deliberately inert, so if this proves annoying, `touch-action: pan-y` at level 1 is the escape hatch — noted in tasks as a verification point.
- **[Hover readout lingering on touch]** With no `mouseleave`, a tapped readout persists. → treated as a feature (inspect without holding a finger on it), dismissed by tapping empty space, starting a gesture, or the existing session/lap resets.
- **[Desktop regression risk]** All touch paths share `zoomRef`/`mouseRef`/`followRef`. → touch handlers only ever write the same object shapes the mouse handlers write; no desktop event path is edited beyond the follow button gaining a pointer-type branch. Lint + type-check + mock-driven manual pass per the verify skill.

## Open Questions

None. The one verification-time judgment call — whether single-finger drag at zoom level 1 stays inert or becomes `pan-y` passthrough — was resolved during implementation: it stays inert, because the mobile layout never places the map inside a scrollable flow (the page root is `overflow-hidden`; only the left tile column scrolls internally), so passthrough would have nothing to scroll.
