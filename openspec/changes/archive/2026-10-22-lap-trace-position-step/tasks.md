# Sample lap traces by position step so long laps record whole

## 1. Recording

- [x] 1.1 In `web/src/hooks/useLapRecordings.ts`, append a sample only when `normalizedPos` clears the previous sample by a minimum step of 1/12000 of a lap, replacing the frame-count `MAX_LAP_SAMPLES` cap
- [x] 1.2 Remove the now-unreachable overflow bookkeeping (`overflowedRef`, `PendingRecording.overflowed`, the held wrap's `overflowed`); `complete` is coverage alone

## 2. Verification

- [x] 2.1 Run `/axl:verify`
- [x] 2.2 In AC, drive a full Nordschleife lap (or any lap over ~3:20) from line to line: from the next lap on, the Delta tile shows a live value and Lap analysis lists that lap instead of "no laps recorded yet"
