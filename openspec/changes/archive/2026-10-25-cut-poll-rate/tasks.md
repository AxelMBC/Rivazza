# Poll the physics page at ~64 Hz instead of the ~35 Hz a 16 ms interval gives on Windows

## 1. Poll interval

- [x] 1.1 Lower `POLL_MS` in `bridge/src/shm/cutDetection.ts` from 16 to 10 ms, below one Windows timer tick, and correct its comment

## 2. Verification

- [x] 2.1 Run `/axl:verify`
- [x] 2.2 In a real AC session, drive four wheels off and back on briefly at a few spots: each excursion should draw one red × on the map and mark the lap INV
