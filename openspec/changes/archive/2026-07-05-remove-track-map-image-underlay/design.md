# Design

## Context

`map.png` is a schematic: AC draws it by stroking the AI spline at a constant width
(`DRAWING_SIZE` in `map.ini`), so its edges are not track limits. A driver at the limit
regularly exceeds the AI line's half-stroke offset and renders outside the ribbon, which
reads as an error. Candidate accurate sources were evaluated and rejected:

- `ai/fast_lane.ai` per-point side widths — the AI's tarmac estimate; excludes curbs,
  which is precisely where a car at the limit sits. Would reduce but not eliminate the
  artifact, at the cost of a binary parser and a new wire payload.
- kn5 road-surface mesh — authoritative, but a per-track 3D asset parse (hundreds of MB)
  is out of scope for a telemetry dashboard.

Decision rule from the user: accurate or absent → absent.

## Goals / Non-Goals

**Goals:**
- No `map.png` rendering; driven lines are the sole track depiction.
- Keep every benefit of `map.ini` metadata: fixed viewport from the first frame, correct
  orientation/handedness, stable framing, zoom behavior.

**Non-Goals:**
- No bridge changes; `/api/track-map/image` stays per `track-asset-resolution`.
- No new track-limit rendering (fast_lane.ai ribbon explicitly rejected for now).
- No changes to lap history, hover, zoom, or gradient behavior.

## Decisions

- **Remove image handling in the web app only.** `MapData` collapses to metadata
  (`{ meta }` — keep the type alias so the mapData/effect structure is untouched), the
  `Image` fetch/decode block goes away, and the `ctx.drawImage` call in the draw loop is
  deleted. The projection, layer caching, and `projKey` logic stay byte-identical.
  Alternative considered: hide behind a toggle — rejected; an inaccurate reference is not
  worth a switch, and the hover/wheel-only UI constraint makes toggles awkward.
- **Drop the "No map image — track bounds from map.ini" note.** Bounds-only is now the
  designed presentation, not a degraded state worth flagging. The no-data note ("No map
  file — drawing your driving line") remains, still satisfying the viewport spec's
  requirement to distinguish drawing-blind from bounds-known.
- **Keep the session `mapAvailable` flag in the wire contract.** Removing it would touch
  both hand-mirrored `types.ts` files and the bridge for zero behavioral gain; the web
  simply ignores it.

## Risks / Trade-offs

- [Losing the at-a-glance track shape before lap one completes] → The first lap draws the
  shape within ~90 s; the map.ini viewport guarantees it draws at final position and
  scale, so nothing jumps.
- [Dead code path: bridge image endpoint unused] → Left intentionally per spec; trivial
  to re-consume if a future accurate-limits feature lands.
