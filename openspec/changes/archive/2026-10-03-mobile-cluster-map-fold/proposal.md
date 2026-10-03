## Why

Below the large breakpoint the dashboard splits the viewport into fixed `35fr / 65fr` rows, so on a
phone (iPhone SE, 375×667) the instrument cluster is clipped inside a 35 %-tall scroll box and the
speedometer has to be scrolled _within its own card_ to be read. The two things a phone viewer opens
the dashboard for — speed and where the car is — should both be visible on the first screen, with
the rest of the dashboard one page scroll away.

## What Changes

- Below the large breakpoint the dashboard becomes a single column that scrolls as one page,
  ordered: instrument cluster, track map, lap-timing tiles, G-force/steering card, lap analysis.
- The first screen (the viewport under the session header) is a **fold** holding exactly the
  instrument cluster, shown in full, and the track map, which takes the remaining height. No
  element scrolls inside its own box any more.
- On phones the page and cluster use tighter padding and gaps so the map keeps a usable minimum
  height (~160 px with the browser's toolbars showing);
  where even that cannot fit (phone landscape) the fold grows past the viewport and the page simply
  scrolls — nothing is clipped.
- The lap-timing tiles, G-force card and lap analysis follow below the fold at their natural
  heights.
- The desktop layout (at and above the large breakpoint) is unchanged: same two columns, same
  no-scroll sidebar fit.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `racer-dashboard`: the "Motorsport visual restyle" requirement's stacked-layout clause ("Below the
  large breakpoint the stacked layout MAY scroll as before") is replaced by a new requirement that
  defines the phone layout — single scrolling column, cluster + track map fold, below-fold order.

## Impact

- `web/src/App.tsx` — the `main` grid and its two column wrappers (mobile order and fold).
- `web/src/components/InstrumentCluster/index.tsx` — tighter padding and gaps below the large
  breakpoint.
- `web/src/components/TrackMap/index.tsx` — its section's sizing inside the fold (min height).
- No bridge, protocol, or desktop-layout change. The track-map canvas keeps `touch-none`, so a page
  scroll starts from the cluster, header or below-fold cards rather than from the map.
