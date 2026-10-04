# Take the live delta's reference from the valid lap recordings

## 1. Delta reference

- [x] 1.1 Derive the delta in `LapTimes` from `resolveReference(recordingsRef, lapsRef)` and `interpolateTimeAt`, and pass `recordingsRef` from `App`
- [x] 1.2 Delete `web/src/hooks/useLapDelta.ts` and its references in `CLAUDE.md`
- [x] 1.3 Expose the lap log's settled lap count and game best from `useLapHistory`; hold the Best-lap tile on it and take the delta reference only from judged laps

## 2. Verification

- [x] 2.1 Run `/axl:verify`
- [x] 2.2 In AC, drive an out-lap from the pits across the line: Best lap stays `--:--.---` and Delta stays `--.--` through lap 2
- [x] 2.3 Cross the line on an invalid lap: Best lap and Delta never flash a value
- [x] 2.4 Restart the session after completing a valid lap: Delta shows `--.--` until a new lap completes
