# Design

## Context

Two independent defects make the track map appear "wrongly oriented":

1. `web/src/components/TrackMap.tsx` requests the map image as
   `/api/track-map/image?v=<track>/<config>` (cache-buster added so a new session never
   shows the previous track's map). The bridge's raw `http` server routes with
   `req.url === '/api/track-map/image'`, and Node's `req.url` includes the query string —
   so the image endpoint has 404'd on every request since the first commit.
   `img.decode()` rejects, the catch treats it as "no map.png", and the UI silently
   drops to bounds-only rendering. The meta endpoint works because its fetch carries no
   query string.
2. The no-map-data fallback projection (`TrackMap.tsx`, heuristic camera path) computes
   `py = height / 2 - (p.z - view.cz) * scale`. The map.ini projection — ground truth,
   since it registers the driven line with AC's own `map.png` — maps world +Z
   **down-screen**. The minus sign mirrors the world across the horizontal axis, so on
   tracks with no map data at all, left turns draw as right turns. The comment claiming
   "driving north moves the dot up" is wrong: AC world axes have no fixed relation to
   compass north (track authors orient meshes arbitrarily).

Verified empirically: the driven trace at Imola (bounds-only mode) matches the stock
`content/tracks/imola/map.png` in shape, rotation, and turn handedness — the map.ini
projection needs no change.

## Goals / Non-Goals

**Goals:**
- The map image endpoint serves `map.png` for any request whose pathname matches,
  regardless of query string.
- All three rendering modes (image, bounds-only, no-data fallback) share the same
  world-to-screen handedness.

**Non-Goals:**
- No rotation controls, "north-up" alignment, or any reorientation of the map.ini
  projection — it is already correct and matches the in-game map app by construction.
- No changes to the wire format, `types.ts` contract, or track asset resolution order.
- No URL routing framework; the bridge stays on the zero-dependency raw `http` style.

## Decisions

- **Strip the query string once, route on the pathname.** In `bridge/src/index.ts`,
  derive `const pathname = url.split('?')[0]` and compare both endpoints against it.
  Alternative considered: `new URL(url, base)` — more machinery than needed for two
  static routes; `split('?')` is idiomatic for this file's raw-http style.
- **Fix the fallback by changing the sign, not the map.ini path.** The map.ini transform
  is validated by dot-on-ribbon registration with `map.png`; the fallback is the outlier.
  Change `-` to `+` in the fallback's Y term and rewrite the comment to state the actual
  invariant: world +Z maps down-screen, matching the map.ini/map.png convention so turn
  handedness is identical in every mode.
- **Keep the client-side cache-buster.** It exists for a real reason (a new session must
  not show a stale map through the browser cache); the bug is purely server-side routing.

## Risks / Trade-offs

- [Users who memorized the mirrored fallback shape see it flip] → Only affects tracks
  with no `map.ini` at all (rare mod tracks); the new orientation is the correct one and
  now consistent with every other track.
- [Regression risk in routing] → Two static string comparisons; verified by curl with and
  without query strings plus the mock session end-to-end.
