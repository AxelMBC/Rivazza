# Split the phone fold 1:3 cluster to 2:3 map and hide the mini map on touch devices

## 1. Implementation

- [x] 1.1 Below `lg`, give the fold a ~384 px minimum and split it by height 1:2 between the cluster and the track map (zero-basis flex), dropping the 160 px map minimum and the phone spacing trims' role as the fit mechanism
- [x] 1.2 Scale the cluster's gauge row uniformly to fit its slot (never above 1×), measured with a ResizeObserver; desktop stays at 1×
- [x] 1.3 Gate the overview inset on a fine primary pointer, reusing `hasCoarsePointer` from `web/src/lib/touch.ts`

## 2. Verification

- [ ] 2.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec deltas
- [x] 2.2 At 375×667 and 375×553, the cluster and map are both fully visible, the map card is ~2× the cluster card, and the cluster is unclipped; desktop boxes at 1366×650 / 1920×945 are unchanged
- [ ] 2.3 On a phone, pinch-zoom past two notches with follow off: no mini map; on a desktop with a mouse, wheel-zoom two notches: the mini map appears as before
