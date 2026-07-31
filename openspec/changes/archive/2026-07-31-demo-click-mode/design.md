# Design — click-driven interaction in demo builds

## Context

The hover-only rule is the dashboard's oldest interaction constraint: clicking the browser gives
it focus, and a focused browser means Assetto Corsa stops reading the wheel and pedals. Every
control in the app is therefore driven by hover, a hover dwell, or the wheel.

The rule was written when the app only ran against a live game. It now also ships as a static
demo build (`VITE_DEMO_MODE=1`) that replays `public/demo/imola.json` and never contacts the
bridge. There is no game to protect in that build, and the hover model actively hurts: the
follow-camera button needs a 1-second cursor dwell that nobody discovers.

A second, independent capability makes this cheap to build. `touch-interaction` already gave every
hover surface a tap counterpart, branched per event on `pointerType === 'touch'`. A click and a tap
want identical behavior — immediate, state-driven, no dwell — so the work is routing mouse events
into an existing path, not writing a second interaction model.

## Goals / Non-Goals

Goals:
- Demo builds activate their controls on a single click.
- Live builds are byte-identical in behavior.
- The active model is visible on screen in both builds.
- Touch behavior is unchanged in both builds.

Non-Goals:
- A runtime click/hover toggle. `demo-replay` already forbids runtime selection of demo mode, and
  a build-time constant lets dead branches be reasoned about statically.
- Clickifying surfaces that read out information rather than act: lap-list rows, analysis lap
  chips, the map's lap-line readout, trace scrubbing. Hovering them is not a control action and
  costs nothing in either mode.
- Wheel zoom and pinch. A click is not a zoom gesture; these are identical in both modes.
- Keyboard or focus-based interaction. Still out of scope everywhere.

## Decisions

### 1. Derive the mode from `IS_DEMO` rather than adding a second flag

`CLICK_MODE = IS_DEMO` in a new `web/src/lib/interaction.ts`. The condition "no live game to steal
focus from" and the condition "this build replays a recording" are the same condition today, and
a second env var would let them drift into a build that is neither safe nor honest about it.

_Alternative considered:_ a separate `VITE_CLICK_MODE`. Rejected — it invites
`VITE_CLICK_MODE=1` on a live build, which is exactly the configuration the hover rule exists to
prevent, and nothing in the app could detect the mistake.

### 2. One predicate widens the existing tap gate

`isImmediateActivation(e)` returns true for `pointerType === 'touch'` always, and additionally for
`pointerType === 'mouse'` when `CLICK_MODE`. Every site that read `e.pointerType === 'touch'` now
calls it. Click behavior is therefore the shipped tap behavior by construction — including the
details that are easy to get wrong, like the lap-list panel stopping propagation so interacting
inside an open flyout does not bubble to the tile toggle that closes it.

_Alternative considered:_ adding `onClick` handlers beside the pointer handlers. Rejected — two
independent code paths per control, with `onClick` firing after `onPointerUp` on the same gesture,
which double-toggles.

### 3. Dropping the `group` class is the kill switch for the CSS reveals

Three panels reveal via Tailwind `group-hover:` variants with a state-driven fallback for touch.
`HOVER_GROUP_CLASS` is `'group'` in hover mode and `''` in click mode, so click mode removes the
marker class and every `group-hover:` variant on that subtree stops matching at once. The `open`
state the touch path already maintains becomes the sole driver, with no change to the components'
existing ternaries. `group` generates no CSS of its own, so the Tailwind scanner is unaffected.

_Alternative considered:_ wrapping each `group-hover:*` variant in a conditional class string.
Rejected — one edit per variant per component, and Tailwind v4 will not generate classes it cannot
see as literals.

### 4. Disarm the hover path, do not merely add the click path

In click mode `startDwell` returns immediately and `LapAnalysis`'s pointer-enter/leave reveal is
skipped. Leaving both live would give one control two mouse triggers, and would make the "Click
mode" pill a half-truth. It also keeps each mode's behavior describable in one sentence, which is
what the spec has to assert.

### 5. The mode pill renders in both builds

It is tempting to show it only in demo builds, where the behavior is the exception. But the pill
earns most of its value in a live build: a user who clicks "Follow car" and sees nothing happen
needs to know that is the design. The pill uses the neutral `ConnectionBadge` tone rather than the
accent-tinted `DemoBadge` tone, since it sits next to the demo badge and accent is already taken;
only the dot color and label differ between modes.

## Risks / Trade-offs

- **The tyre-overlay click target is the whole instrument cluster.** The toggle sits on the cluster
  `<section>`, not on a dedicated control, so in click mode a click anywhere on the cluster shows
  or dismisses the overlay. This is inherited verbatim from the shipped tap target and is accepted
  rather than redesigned; narrowing it would change touch behavior too.
- **Two interaction models to keep working.** Any future hover surface must decide which bucket it
  is in. The predicate makes the decision explicit at the call site, and `verify` covers both
  modes.
- **The pill adds a third header pill.** The row is already `flex flex-wrap`, and
  `responsive-header` specifies stacking below the small breakpoint, so no layout change was
  needed.
