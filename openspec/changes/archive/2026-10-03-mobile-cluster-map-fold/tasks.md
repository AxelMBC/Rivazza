## 1. Desktop baseline

- [x] 1.1 With the mock and `npm run dev` running, record the bounding boxes of the cluster, lap
      tiles, DriverInputs card, track map and lap-analysis bar at 1366×650, 1536×730 and 1920×945
      (verify skill's puppeteer setup), and whether the G-meter is shown at each, as the
      before-values for 4.2

## 2. Layout restructure (`web/src/App.tsx`)

- [x] 2.1 Replace the two column wrappers with a fold wrapper (InstrumentCluster + TrackMap,
      `flex-col h-full min-h-fit shrink-0` below `lg`, `lg:contents`) followed by LapTimes,
      DriverInputs and LapAnalysis as direct children of `main`
- [x] 2.2 Make `main` a `flex-col overflow-y-auto` column below `lg`, and at `lg` a grid with
      columns `24rem 1fr`, rows `auto auto 1fr auto` and areas
      `"cluster map" "laps map" "inputs map" "inputs analysis"`; place each child in its area
- [x] 2.3 Preserve today's desktop gaps: `gap-x-4 gap-y-3`, plus a 4 px top margin on LapAnalysis
      at `lg` so the map→analysis gap stays 16 px
- [x] 2.4 Give TrackMap's section a 160 px minimum height below `lg` so it fills the fold's
      remainder (`flex-1`) without collapsing; keep its desktop sizing unchanged

## 3. Phone spacing (`App.tsx`, `InstrumentCluster/index.tsx`)

- [x] 3.1 Below `lg`, tighten page padding and gaps (16 → 12 px), cluster padding (16 → 12 px) and
      the cluster's right-column gap (8 → 6 px), restoring each with `lg:` classes
- [x] 3.2 Measure at 375×553 and 375×667: map ≥ 160 px and ≥ 250 px respectively, with the full
      cluster above it

## 4. Verification

- [x] 4.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec deltas
- [x] 4.2 At 1366×650, 1536×730 and 1920×945, the bounding boxes from 1.1 are unchanged, no
      sidebar scrollbar appears, and the G-meter shown/hidden state matches
- [x] 4.3 At 375×667 and 375×553 with the demo replay (`npm run dev:demo`), the full cluster and the
      full track-map card are visible on load with no scrolling, the cluster has no internal
      scrollbar, and the map is ≥ 250 px tall at 667 and ≥ 160 px at 553
- [ ] 4.4 At 375×667, scrolling the page shows the lap tiles, G-force/steering card (circular
      meter) and lap-analysis bar in that order, and the scroll reaches the bottom of the
      lap-analysis bar; tapping the bar opens the analysis panel readably
- [x] 4.5 At 667×375, neither the cluster nor the map is clipped or below its minimum, and the rest
      of the dashboard is reachable by scrolling
- [ ] 4.6 On a real phone (or touch emulation): pinch/pan on the map zooms/pans without scrolling
      the page; a swipe starting on the cluster or header scrolls the page without toggling the
      tyre overlay
