# Fix track map image 404 and mirrored no-data fallback

## Why

The track map background image has never rendered for any track: the web app requests
`/api/track-map/image?v=<track>` (cache-buster), but the bridge matches `req.url` — which
includes the query string — with strict equality, so every image request 404s and the map
silently degrades to bounds-only mode. Separately, the no-map-data fallback projection
flips the Z axis relative to the map.ini/map.png convention, so on tracks without any map
data the driven line is drawn mirrored (left turns render as right turns). Together these
made the map feel "wrong orientation" even though the map.ini projection itself is correct.

## What Changes

- Bridge HTTP routing matches endpoint **pathnames**, ignoring any query string, so
  `/api/track-map/image?v=imola` serves `map.png` when it exists.
- The no-map-data fallback projection in `TrackMap` uses the same handedness as the
  map.ini/map.png convention (world +Z maps down-screen), so turn direction reads
  identically in all three rendering modes (image, bounds-only, no-data).
- The stale "Y is flipped so driving north moves the dot up" comment is replaced — AC
  world axes have no relation to compass north.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `track-asset-resolution`: the map image endpoint must respond when the image exists
  **regardless of query string** on the request URL (the web client always appends a
  cache-busting parameter).
- `track-map-viewport`: the heuristic no-data fallback must render with the same
  world-to-screen handedness as the map.ini projection so turn direction is never
  mirrored between modes.

## Impact

- `bridge/src/index.ts` — HTTP request routing (pathname matching).
- `web/src/components/TrackMap.tsx` — fallback projection Y term and its comment.
- No wire-format, type-contract, or dependency changes. Once the endpoint fix lands,
  users see the official `map.png` under the driving line on stock tracks — a visible
  behavior change (for the better).
