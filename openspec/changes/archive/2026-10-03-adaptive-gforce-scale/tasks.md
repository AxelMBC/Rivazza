# Grow the G-force meter one ring at a time as the car passes its scale

## 1. Implementation

- [x] 1.1 In `GForceMeter.tsx`, start at 1G/2G rings and add a ring each time a sample passes the outermost ring + 0.5G, capped at a 5G ring

## 2. Verification

- [x] 2.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec delta
- [ ] 2.2 In the demo replay, confirm the meter starts with two rings, gains a ring each time the car passes the edge, and never drops back
