# Design — track-map-bounds

## Context

The web track map has three data situations: map image + bounds, bounds only, nothing. Today the bridge collapses the first two into one check (`map.png` AND `map.ini` required), and the default `AC_PATH` misses non-default Steam installs entirely — so the user's stock-Imola sessions land in "nothing" and the web app guesses the viewport, which has produced three rounds of unsatisfying first-lap behavior. `map.ini` alone determines the full world-to-canvas transform: `WIDTH`/`HEIGHT` (pixel canvas), `X_OFFSET`/`Z_OFFSET` (world origin shift), `SCALE_FACTOR` (meters per pixel). World extent = `WIDTH × SCALE_FACTOR` by `HEIGHT × SCALE_FACTOR`.

## Goals / Non-Goals

**Goals:**
- Find the AC install on real machines (secondary Steam libraries) with zero config.
- Serve track bounds whenever `map.ini` exists, image or not.
- Bounds-only rendering: fixed, correct viewport from frame one — visually identical framing to map-image mode, minus the image.
- Keep the existing heuristic as the true last resort.

**Non-Goals:**
- No rendering of AC's `outline.png` or other alternate assets.
- No persistence of learned bounds across sessions for bounds-less tracks.
- No changes to gradient coloring, lap lifecycle, or restart detection.

## Decisions

### D1: Steam discovery via `libraryfolders.vdf`, no VDF dependency
Resolution order in `trackAssets.ts`: `AC_PATH` env → parse `C:\Program Files (x86)\Steam\config\libraryfolders.vdf` (and `Program Files` variant) extracting `"path" "..."` entries with a regex, checking each `<lib>\steamapps\common\assettocorsa` → hard-coded default. Resolved once at module init and logged. A full VDF parser is overkill for extracting path strings; regex matches the existing `map.ini` parsing style. Alternative — registry lookup via `reg query` — rejected: spawning processes for this is heavier and Windows-only in a different way; the vdf covers the common case (it lists *all* libraries including the default).

### D2: `resolveTrackAssets` returns meta and image path independently
Return `{ meta: MapMeta | null, mapImagePath: string | null }` per candidate dir (layout dir first, then track root — unchanged). Meta requires `data/map.ini`; image additionally requires `map.png`. First candidate with at least meta wins. `SessionInfo` gains `boundsAvailable` (meta ≠ null); `mapAvailable` keeps meaning image+meta so existing web logic is untouched. Both `types.ts` files updated in sync.

### D3: Web — one projection, three backgrounds
`TrackMap` fetches `/api/track-map/meta` whenever `boundsAvailable`, and the image only when `mapAvailable`. Rendering unifies: if meta exists, use the map.ini projection (current map-image code path) with the image drawn only when loaded — bounds-only mode simply skips `drawImage`. This deletes the special-case gap: first frame is already correctly framed because the projection depends only on meta and canvas size. The heuristic camera (anchor + eased zoom-out) remains solely for the meta-less case. Corner note becomes: bounds-only → "No map image — track bounds from map.ini"; nothing → existing "No map file — drawing your driving line".

### D4: Session shape change is additive
`boundsAvailable` is a new boolean on the session message; old clients ignore it. No protocol version needed.

## Risks / Trade-offs

- [`libraryfolders.vdf` format shifts across Steam versions] → The `"path" "X"` key/value shape has been stable for years; regex tolerates surrounding structure. Worst case we fall back to default path + `AC_PATH`, i.e. today's behavior, with a logged warning telling the user to set `AC_PATH`.
- [map.ini WIDTH/HEIGHT sometimes disagree with map.png pixel size on mod tracks] → In image mode we keep using the image's own dimensions for drawing (unchanged behavior); meta dimensions drive only the bounds-only mode, where they're the sole source of truth anyway.
- [Bounds-only viewport includes map margins] → map.ini bounds include the same padding the map image has, so framing matches image mode exactly — that's the desired look (user's reference screenshot is the fitted full-track view).

## Migration Plan

Additive; restart the bridge (`npm run dev`). If discovery still misses the install (unusual Steam setup), setting `AC_PATH` remains the documented escape hatch — the startup log now says so explicitly.

## Open Questions

- None blocking. If the user's install turns out to genuinely lack `map.png` for stock tracks (unlikely), bounds-only mode is exactly the designed outcome.
