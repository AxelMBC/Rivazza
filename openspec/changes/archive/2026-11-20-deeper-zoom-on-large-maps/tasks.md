# Let the deepest track-map zoom reach ~30 m on every track, never below 40×

## 1. Zoom cap

- [x] 1.1 In `web/src/components/TrackMap/constants.ts`, rename `ZOOM_MAX` to `ZOOM_MAX_FLOOR` (still 40) and add `ZOOM_MIN_WINDOW_M = 30`
- [x] 1.2 In `camera.ts`, export `maxZoomLevel(base, width, height)`: the larger of `ZOOM_MAX_FLOOR` and `min(width, height) / (ZOOM_MIN_WINDOW_M × the base projection's px per metre)`
- [x] 1.3 In `TrackMap/index.tsx`, create a `zoomMaxRef` in the render effect (like `insetRef`), write `maxZoomLevel(base, width, height)` to it in both projection branches before the camera runs, and hand it to `createCamera` and `attachGestures`
- [x] 1.4 Clamp wheel and pinch zoom in `gestures.ts`, and the follow camera's tightest window in `camera.ts`, with `zoomMaxRef.current` instead of the constant

## 2. Verification

- [x] 2.1 Run `/axl:verify`
- [x] 2.2 On SRP, scroll in to the stop over an interchange: about 30 m spans the map's shorter side, the lanes and driven line stay registered, and each notch repaints without a stall. With follow on, scrolling in now stops at the ~100 m follow floor instead of far out
- [x] 2.3 On Imola, the deepest zoom is at most a notch deeper than before (~30 m across the shorter side) and the tightest follow framing is unchanged
