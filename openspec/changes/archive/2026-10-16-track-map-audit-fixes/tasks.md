# Fix the track map audit findings: fractional-DPR canvas resets, mirrored projections, the lap-record repaint input, and small TrackMap cleanups

## 1. Behaviour fixes

- [x] 1.1 Size canvas backing stores to the rounded device-pixel size and compare against it, in the track map, G-force meter and lap analysis canvases
- [x] 1.2 Give `Affine` a signed scale per axis and use it in `strokeWorldPath`, the track and inset layers, with line widths from the scale's magnitude
- [x] 1.3 Add the lap log's length to the track map's repaint gate

## 2. Cleanups

- [x] 2.1 Derive the hover readout's pedal label from `bucketKey` instead of re-stating the dead-zone rule
- [x] 2.2 Move the hover readout's and markers' raw colours into `palette.ts`
- [x] 2.3 Decide "which stored laps get an identity colour" in one helper used by the layers, hover emphasis, hit test and legend
- [x] 2.4 Move the zoom-gesture follow transitions into the follow control, shared by wheel and pinch
- [x] 2.5 Bump `lapsVersion` in the line recorder's `reset()` instead of only on restart

## 3. Verification

- [x] 3.1 Run `/axl:verify`
- [x] 3.2 At 125% Windows scaling, drive a few laps: the map, G-force meter and lap analysis render as before, and hovering a stored lap shows its readout with the right pedal label
