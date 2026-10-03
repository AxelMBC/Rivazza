# Split the phone fold 1:3, hide the mini map on touch, end follow on a touch pan

## 1. Implementation

- [x] 1.1 Below `lg`, give the fold a ~384 px minimum and split it by height 1:2 between the cluster and the track map (a `1fr 2fr` grid), dropping the 160 px map minimum and the phone spacing trims' role as the fit mechanism
- [x] 1.2 Scale the cluster's gauge row uniformly to fit its slot (never above 1×), measured with a ResizeObserver; desktop stays at 1×
- [x] 1.3 Gate the overview inset on a fine primary pointer, reusing `hasCoarsePointer` from `web/src/lib/touch.ts`
- [x] 1.4 Make the phone G-force card taller (`h-42` → `h-96`) so the meter is legible
- [x] 1.5 End follow mode on a one-finger pan instead of detaching: drop the `detached` follow state so the button returns to "Follow car"
- [x] 1.6 Keep the header reachable on iOS: size the app to the dynamic viewport (`h-dvh`), stop the document itself from scrolling, and contain the dashboard scroller's overscroll

## 2. Verification

- [ ] 2.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec deltas
- [x] 2.2 At 375×667 and 375×553, the cluster and map are both fully visible, the map card is ~2× the cluster card, and the cluster is unclipped; desktop boxes at 1366×650 / 1920×945 are unchanged
- [ ] 2.3 On a phone, pinch-zoom past two notches with follow off: no mini map; on a desktop with a mouse, wheel-zoom two notches: the mini map appears as before
- [ ] 2.4 On a phone: tap Follow car, pan with one finger — tracking stops in place and the button reads "Follow car"; tapping it resumes tracking. The G-force card shows a large circular meter
- [ ] 2.5 On an iPhone: scroll to the bottom, then back to the top — the header (track, car, driver) is fully visible again
