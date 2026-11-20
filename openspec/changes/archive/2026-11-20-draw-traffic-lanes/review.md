# Review: draw-traffic-lanes

Snapshot: 7e2533a84430901ef94837fd1182e6d8549cbb6a

1. [duplicate] bridge/src/content/trafficLanes.ts:12 — `roundCm` re-declares, word for word, the one at `bridge/src/content/aiSpline.ts:41`; both round a wire payload (edges, lanes) to centimetres and can drift apart · fixed
   Fix: export one `roundCm` from a shared bridge content module (e.g. beside `insideMapBounds` in `mapBounds.ts`) and import it in both files.

## Decisions

- Under the follow cam or an inset glide `projKey` changes every frame, so the track layer re-strokes SRP's 23,105-point
  lane path twice per frame. Whether that fits the frame budget only the running page shows: when running manual check
  6.3, also drive a stretch with follow on, not only wheel notches.
