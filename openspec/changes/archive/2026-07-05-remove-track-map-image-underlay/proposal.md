# Remove the map.png underlay from the track map

## Why

With the image endpoint fixed, the official `map.png` outline started rendering under the
driven lines — and it misrepresents track limits. AC generates `map.png` as a
constant-width stroke around the AI racing line (`DRAWING_SIZE`, ~12 m at Imola), not the
real road edges, so a car legitimately using the full track width at corner limits appears
to run "outside the street". No reliable local source for true track limits exists at
reasonable cost (`ai/fast_lane.ai` side data excludes curbs — wrong exactly at the limit;
the kn5 road mesh is a 400 MB binary parse far beyond this dashboard's scope). Per the
decision rule "accurate or absent", the underlay goes.

## What Changes

- The web track map no longer requests or draws `map.png`. The driven lines (current lap
  pedal-gradient + per-lap history) are the only track depiction.
- `map.ini` metadata keeps doing everything else: fixed viewport, correct orientation,
  projection — nothing about framing or handedness changes.
- The "No map image — track bounds from map.ini" header note is dropped (bounds-only is
  now the standard presentation, not a degraded mode); the "No map file — drawing your
  driving line" note stays for tracks with no map data at all.
- The bridge is untouched: `/api/track-map/image` remains available per
  `track-asset-resolution` (the web app simply stops calling it).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `track-map-viewport`: the map.ini-driven mode is defined as lines-only — the map SHALL
  NOT render the `map.png` image; metadata is used solely for viewport and projection.
- `driving-line-gradient`: mode wording updated — gradient applies in the metadata
  (map.ini) mode and the breadcrumb fallback; the "map image available" mode no longer
  exists.

## Impact

- `web/src/components/TrackMap.tsx` — remove image fetch/decode/draw and the related
  header note.
- `openspec/specs/track-map-viewport`, `openspec/specs/driving-line-gradient` — delta
  specs.
- Visible change: the white outline disappears; framing, orientation, zoom, lap colors,
  and hover behavior are unchanged.
